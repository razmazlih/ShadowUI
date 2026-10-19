import test from 'node:test';
import assert from 'node:assert/strict';
import {seedDefinitions} from '../lib/catalog';
import {getDefinition,getDefinitionHistory,listDefinitions,saveDefinition,setDefinitionStatus,rollbackDefinition,saveGeneratedDefinition,getCatalogEmbeddingCache,setCatalogEmbeddingCache} from '../lib/catalog-store';

test('Firestore lifecycle preserves immutable versions, private scope and CAS',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
 const id=`test-${crypto.randomUUID()}`;const seed=seedDefinitions().find(d=>d.id==='calculator')!;
 const definition={...seed,id,scope:'private' as const,ownerSession:'owner-a',source:'ai' as const,status:'draft' as const};
 const {definition:active}=await saveGeneratedDefinition(definition,'owner-a');assert.equal(active.status,'active');assert.equal(active.version,2);
 assert.equal(await getDefinition(id,undefined,{session:'owner-b'}),null);assert.equal(await getDefinition(id),null);assert.equal((await getDefinition(id,undefined,{session:'owner-a'}))?.version,2);
 await assert.rejects(saveDefinition({...active,version:3},{session:'owner-b'}),/Forbidden/);
 await assert.rejects(saveDefinition({...active,version:3},{session:'owner-a',expectedVersion:1}),/conflict/);
 const retired=await setDefinitionStatus(id,'retired',{session:'owner-a',includeDrafts:true});assert.equal(retired.version,3);
 assert.equal((await getDefinition(id,2,{session:'owner-a'}))?.status,'active');
 const restored=await rollbackDefinition(id,2,{session:'owner-a',includeDrafts:true});assert.equal(restored.version,4);assert.equal(restored.status,'active');
 assert.deepEqual((await getDefinitionHistory(id,{session:'owner-a',includeDrafts:true})).map(d=>d.definition.version),[4,3,2,1]);
 assert.equal((await listDefinitions()).some(d=>d.id===id),false);
 const shared=await getDefinition('calculator',undefined,{admin:true});assert.ok(shared);await assert.rejects(saveDefinition({...shared!,version:shared!.version+1},{session:'owner-a'}),/Forbidden/);
 await setCatalogEmbeddingCache(id,[0.1,0.2]);assert.deepEqual(await getCatalogEmbeddingCache(id),[0.1,0.2]);
});
