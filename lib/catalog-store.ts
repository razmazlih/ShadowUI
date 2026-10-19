import {ComponentDefinitionSchema,seedDefinitions,validateDefinition,type ComponentDefinition,type CatalogRevision} from './catalog';
import {catalogDatabase} from './firebase-admin';
import {createHash} from 'node:crypto';
import type {EmbeddingCache} from './semantic-search';

export type CatalogAccess={session?:string;admin?:boolean;includeDrafts?:boolean};
const collection=()=>catalogDatabase().collection('shadowui_component_catalog');
let seedPromise:Promise<void>|undefined;
const canRead=(d:ComponentDefinition,access:CatalogAccess)=>access.admin||(d.scope==='shared'?d.status==='active':!!access.session&&d.ownerSession===access.session&&(d.status==='active'||access.includeDrafts));
const canWrite=(d:ComponentDefinition,access:CatalogAccess)=>access.admin||(d.scope==='private'&&!!access.session&&d.ownerSession===access.session&&d.source==='ai');
export async function ensureCatalogSeeds(){
 if(seedPromise)return seedPromise;
 seedPromise=(async()=>{for(const definition of seedDefinitions()){
  const ref=collection().doc(definition.id);
  await catalogDatabase().runTransaction(async transaction=>{const snapshot=await transaction.get(ref);if(snapshot.exists)return;
   transaction.create(ref,{definition});transaction.create(ref.collection('revisions').doc('1'),{definition,validation:validateDefinition(definition),changedAt:definition.updatedAt});
  });
 }})();
 try{await seedPromise;}catch(error){seedPromise=undefined;throw error;}
}
export async function listDefinitions(access:CatalogAccess={}):Promise<ComponentDefinition[]>{
 await ensureCatalogSeeds();
 // Scope predicates are enforced here; Firestore rules deny direct client access.
 const snapshot=await collection().get();
 return snapshot.docs.map(doc=>ComponentDefinitionSchema.parse(doc.data().definition)).filter(definition=>canRead(definition,access));
}
export async function getDefinition(id:string,version?:number,access:CatalogAccess={}):Promise<ComponentDefinition|null>{
 if(!/^[a-z][a-z0-9_-]{0,79}$/.test(id))return null;
 const ref=collection().doc(id);
 const snapshot=await(version?ref.collection('revisions').doc(String(version)):ref).get();
 if(!snapshot.exists)return null;const definition=ComponentDefinitionSchema.parse(snapshot.data()!.definition);
 return canRead(definition,access)?definition:null;
}
export async function getDefinitionHistory(id:string,access:CatalogAccess={}):Promise<CatalogRevision[]>{
 if(!/^[a-z][a-z0-9_-]{0,79}$/.test(id))return [];
 const snapshot=await collection().doc(id).collection('revisions').get();
 return snapshot.docs.map(doc=>doc.data() as CatalogRevision).filter(revision=>canRead(revision.definition,access)).sort((a,b)=>b.definition.version-a.definition.version);
}
export async function saveDefinition(input:ComponentDefinition,access:CatalogAccess&{expectedVersion?:number}={}):Promise<ComponentDefinition>{
 const definition=ComponentDefinitionSchema.parse(input);
 if(!canWrite(definition,access))throw new Error('Forbidden catalog mutation');
 const validation=validateDefinition(definition);
 if(definition.status==='active'&&!validation.valid)throw new Error(`Definition validation failed: ${validation.errors.join('; ')}`);
 const ref=collection().doc(definition.id);
 return catalogDatabase().runTransaction(async transaction=>{
  const snapshot=await transaction.get(ref);const previous=snapshot.exists?ComponentDefinitionSchema.parse(snapshot.data()!.definition):null;
  if(previous&&!canWrite(previous,access))throw new Error('Forbidden catalog mutation');
  if(previous&&(previous.scope!==definition.scope||previous.ownerSession!==definition.ownerSession))throw new Error('Definition ownership and scope are immutable');
  if(access.expectedVersion!==undefined&&access.expectedVersion!==(previous?.version??0))throw new Error('Catalog version conflict');
  if(previous&&definition.version!==previous.version+1)throw new Error('Catalog version conflict');
  if(!previous&&definition.version!==1)throw new Error('New definitions must start at version 1');
  const next={...definition,createdAt:previous?.createdAt??definition.createdAt,updatedAt:new Date().toISOString()};
  transaction.set(ref,{definition:next});transaction.create(ref.collection('revisions').doc(String(next.version)),{definition:next,validation,changedAt:next.updatedAt});return next;
 });
}
export async function setDefinitionStatus(id:string,status:ComponentDefinition['status'],access:CatalogAccess&{expectedVersion?:number}={}):Promise<ComponentDefinition>{
 const current=await getDefinition(id,undefined,{...access,includeDrafts:true});if(!current)throw new Error('Definition not found');
 if(access.expectedVersion!==undefined&&access.expectedVersion!==current.version)throw new Error('Catalog version conflict');
 return saveDefinition({...current,status,version:current.version+1}, {...access,expectedVersion:current.version});
}
export async function rollbackDefinition(id:string,version:number,access:CatalogAccess&{expectedVersion?:number}={}):Promise<ComponentDefinition>{
 const [current,target]=await Promise.all([getDefinition(id,undefined,{...access,includeDrafts:true}),getDefinition(id,version,{...access,includeDrafts:true})]);
 if(!current||!target)throw new Error('Definition not found');
 if(access.expectedVersion!==undefined&&access.expectedVersion!==current.version)throw new Error('Catalog version conflict');
 return saveDefinition({...target,version:current.version+1}, {...access,expectedVersion:current.version});
}
/** Private data stays owner scoped; callers must supply a sanitized reusable definition. */
export async function saveGeneratedDefinition(input:ComponentDefinition,session:string){
 const draft=await saveDefinition({...input,source:'ai',scope:'private',ownerSession:session,status:'draft'}, {session});
 const validation=validateDefinition(draft);if(!validation.valid)return {definition:draft,validation};
 return {definition:await setDefinitionStatus(draft.id,'active',{session,includeDrafts:true}),validation};
}
/** Cache only public catalog-description embeddings, never user query vectors or private data. */
export async function getCatalogEmbeddingCache(key:string):Promise<number[]|null>{
 const id=createHash('sha256').update(key).digest('hex');const snapshot=await catalogDatabase().collection('shadowui_catalog_embeddings').doc(id).get();
 const vector=snapshot.data()?.vector;
 return Array.isArray(vector)&&vector.length<=4096&&vector.every(value=>typeof value==='number'&&Number.isFinite(value))?vector:null;
}
export async function setCatalogEmbeddingCache(key:string,vector:number[]):Promise<void>{
 if(!vector.length||vector.length>4096||vector.some(value=>!Number.isFinite(value)))throw new Error('Invalid embedding vector');
 const id=createHash('sha256').update(key).digest('hex');await catalogDatabase().collection('shadowui_catalog_embeddings').doc(id).set({vector,updatedAt:new Date().toISOString()});
}
export const catalogEmbeddingCache:EmbeddingCache={
 async get(key){const vector=await getCatalogEmbeddingCache(key);return vector?{model:'text-embedding-3-small',fingerprint:key.slice(key.lastIndexOf(':')+1),vector}:null;},
 async put(key,record){await setCatalogEmbeddingCache(key,record.vector);},
};
