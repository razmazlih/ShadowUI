import test from 'node:test';
import assert from 'node:assert/strict';
import {seedDefinitions,validateDefinition} from '../lib/catalog';
import {createReviewCandidate,proposeReviewEdit} from '../lib/component-review';
import {enqueueComponentReview,updateComponentReview} from '../lib/component-review-store';
import {catalogDatabase} from '../lib/firebase-admin';
const source=()=>({...structuredClone(seedDefinitions().find(d=>d.id==='calculator')!),id:`private_${crypto.randomUUID()}`,source:'ai' as const,scope:'private' as const,ownerSession:'private-owner'});
test('review copies preserve calculation but contain no private text or values',()=>{
 const definition=source();definition.name='Secret person';definition.description='Secret request';definition.template.title='Secret title';definition.template.custom!.purpose='Secret purpose';definition.template.custom!.fields[0].label='Secret salary';definition.template.custom!.fields[0].value='92835';
 const candidate=createReviewCandidate(definition);assert.equal(candidate.status,'pending');assert.equal(candidate.definition.scope,'shared');assert.equal(candidate.definition.ownerSession,undefined);assert.ok(candidate.validation.valid);assert.equal(JSON.stringify(candidate).includes('Secret'),false);assert.equal(JSON.stringify(candidate).includes('92835'),false);assert.equal(candidate.definition.template.custom!.outputs[0].expression[0],'field_1');assert.equal(definition.template.custom!.fields[0].value,'92835');
});
test('simulation proposes bounded edits without mutation or model calls',()=>{
 const definition=createReviewCandidate(source()).definition;const result=proposeReviewEdit(definition,'רחב');assert.equal(result.after.template.span,'wide');assert.equal(definition.template.span,'normal');assert.ok(validateDefinition(result.after).valid);assert.throws(()=>proposeReviewEdit(definition,'invent code'),/Simulation/);
});
test('emulator review lifecycle: private activity, CAS, synthetic confirmation and immutable publication',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
 const definition=source();definition.capabilities=['calculate.area','calculate.private_payroll'];const candidate=await enqueueComponentReview(definition);
 await assert.rejects(updateComponentReview(candidate.id,{action:'approve',expectedVersion:1}),/synthetic/);
 const approved=await updateComponentReview(candidate.id,{action:'approve',expectedVersion:1,syntheticDataConfirmed:true});assert.ok('candidate' in approved);if(!('candidate' in approved))return;
 assert.equal(approved.candidate.status,'approved');assert.equal(definition.status,'active');
 await assert.rejects(updateComponentReview(candidate.id,{action:'reject',expectedVersion:1,reason:'stale'}),/conflict/);
 const first=await catalogDatabase().collection('shadowui_component_catalog').doc(candidate.definition.id).collection('revisions').doc('1').get();assert.ok(first.exists);assert.ok(first.data()!.definition.capabilities.includes('calculate.area'));assert.equal(first.data()!.definition.capabilities.includes('calculate.private_payroll'),false);
 const edit=await updateComponentReview(candidate.id,{action:'edit',expectedVersion:2,syntheticDataConfirmed:true,definition:{...candidate.definition,name:'Edited synthetic name'}});assert.ok('candidate' in edit);if(!('candidate' in edit))return;assert.equal(edit.candidate.status,'pending');
 await updateComponentReview(candidate.id,{action:'approve',expectedVersion:3,syntheticDataConfirmed:true});
 const second=await catalogDatabase().collection('shadowui_component_catalog').doc(candidate.definition.id).collection('revisions').doc('2').get();assert.equal(second.data()!.definition.name,'Edited synthetic name');assert.notEqual(first.data()!.definition.name,'Edited synthetic name');
});
test('table review removes cells, names, column IDs, labels and row values',()=>{
 const definition={...source(),template:{id:'secret-table',type:'table' as const,title:'Secret title',reason:'Secret reason',span:'wide' as const,items:[{id:'private-row',label:'Secret volunteer',cells:{secret_stock:92835}}],recordTool:{columns:[{id:'secret_stock',label:'Secret stock'}],outputs:[{id:'secret_total',label:'Secret output',expression:['secret_stock','92835','-'],unit:'Secret unit'}]}}};
 const candidate=createReviewCandidate(definition);const json=JSON.stringify(candidate);assert.equal(json.includes('Secret'),false);assert.equal(json.includes('secret_stock'),false);assert.equal(json.includes('92835'),false);assert.equal(candidate.definition.template.recordTool?.outputs[0].expression[1],'parameter_1');assert.equal(candidate.definition.template.items[0].cells?.column_1,1);assert.ok(candidate.validation.valid);
});
test('review APIs deny unauthenticated listing and mutation before database access',async()=>{
 const listing=await import('../app/api/admin/components/route');const mutation=await import('../app/api/admin/components/[id]/route');
 assert.equal((await listing.GET(new Request('http://localhost/api/admin/components'))).status,403);
 assert.equal((await mutation.POST(new Request('http://localhost/api/admin/components/review_a',{method:'POST'}),{params:Promise.resolve({id:'review_a'})})).status,403);
});
test('sanitization parameterizes private constants while retaining formula operators and substitution semantics',async context=>{
 // Whole-candidate privacy checks must not match a coincidental timestamp such
 // as 07:53:50.170Z, which also contains the private token "0.17".
 context.mock.timers.enable({apis:['Date'],now:Date.parse('2026-01-01T00:00:00.000Z')});
 const {evaluateCustomTool}=await import('../lib/custom-tool');
 const definition=source();definition.template.custom!.fields=[{id:'privateNeeded',label:'Private needed',type:'number',value:'700',options:[],min:null,max:null},{id:'privateAvailable',label:'Private available',type:'number',value:'100',options:[],min:null,max:null}];definition.template.custom!.outputs=[{id:'privateShortage',label:'Private shortage',expression:['privateNeeded','privateAvailable','-','0','max'],unit:''},{id:'privateTax',label:'Private tax',expression:['privateNeeded','0.17','*'],unit:''}];
 const sanitized=createReviewCandidate(definition).definition.template.custom!;
 assert.deepEqual(sanitized.outputs[0].expression,['field_1','field_2','-','0','max']);assert.deepEqual(sanitized.outputs[1].expression,['field_1','parameter_1','*']);assert.equal(JSON.stringify(createReviewCandidate(definition)).includes('0.17'),false);assert.equal(sanitized.fields[2].value,'1');
 for(const [needed,available] of [[10,20],[20,10],[0,0]]){
  const original=structuredClone(definition.template.custom!);const clone=structuredClone(sanitized);
  [original.fields[0].value,original.fields[1].value]=[String(needed),String(available)];[clone.fields[0].value,clone.fields[1].value]=[String(needed),String(available)];clone.fields[2].value='0.17';
  assert.deepEqual(evaluateCustomTool(original).map(x=>x.value),evaluateCustomTool(clone).map(x=>x.value));
 }
 assert.match(createReviewCandidate(definition).purpose,/3 inputs and 2 outputs/);assert.match(createReviewCandidate(definition).gap,/max/);
});
test('collection candidate remains active-capable without invented formula outputs',()=>{
 const definition=source();definition.template.custom!.outputs=[];const candidate=createReviewCandidate(definition);assert.ok(candidate.validation.valid);assert.deepEqual(candidate.definition.capabilities,['input.form']);assert.equal(candidate.definition.template.custom!.outputs.length,0);
});
test('verified administrator alone can list and approve reviews through API',{skip:!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST},async()=>{
 const {getAuth}=await import('firebase-admin/auth');const {firebaseApp}=await import('../lib/firebase-admin');
 const {GET}=await import('../app/api/admin/components/route');const {POST}=await import('../app/api/admin/components/[id]/route');
 const allowlist=process.env.FIREBASE_ADMIN_EMAIL;const email=`review-admin-${crypto.randomUUID()}@example.test`;process.env.FIREBASE_ADMIN_EMAIL=email;
 try{
  async function identity(email:string){await getAuth(firebaseApp()).createUser({email,emailVerified:true,password:'emulator-password'});const response=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'emulator-password',returnSecureToken:true})});assert.equal(response.status,200);return (await response.json()).idToken as string;}
  const admin=await identity(email),reader=await identity(`review-reader-${crypto.randomUUID()}@example.test`);const candidate=await enqueueComponentReview(source());
  const request=(token:string,body?:unknown)=>new Request('http://localhost/api/admin/components',{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await GET(request(reader))).status,403);assert.equal((await GET(request(admin))).status,200);
  const context={params:Promise.resolve({id:candidate.id})},body={action:'approve',expectedVersion:1,syntheticDataConfirmed:true};
  assert.equal((await POST(request(reader,body),context)).status,403);const response=await POST(request(admin,body),context);assert.equal(response.status,200);assert.equal((await response.json()).candidate.status,'approved');
 }finally{if(allowlist===undefined)delete process.env.FIREBASE_ADMIN_EMAIL;else process.env.FIREBASE_ADMIN_EMAIL=allowlist;}
});
test('repeated private literals reuse one synthetic parameter and structural constants remain',context=>{
 context.mock.timers.enable({apis:['Date'],now:Date.parse('2026-01-01T00:00:00.000Z')});
 const definition=source();definition.template.custom!.outputs=[{id:'result',label:'Private',expression:['quantity','0.17','*','unitValue','0.17','*','+','-1','max'],unit:''}];
 const candidate=createReviewCandidate(definition),tool=candidate.definition.template.custom!;
 assert.equal(tool.fields.filter(field=>field.id.startsWith('parameter_')).length,1);assert.equal(tool.outputs[0].expression.filter(token=>token==='parameter_1').length,2);assert.ok(tool.outputs[0].expression.includes('-1'));assert.equal(JSON.stringify(candidate).includes('0.17'),false);assert.equal(definition.template.custom!.outputs[0].expression[1],'0.17');
});
test('synthetic parameter overflow produces safe invalid placeholder until explicit admin edit',async()=>{
 const definition=source();definition.template.custom!.fields=Array.from({length:16},(_,i)=>({id:`private_${i}`,label:`Private ${i}`,type:'number' as const,value:'92835',options:[],min:null,max:null}));definition.template.custom!.outputs=[{id:'private_output',label:'Private result',expression:['private_0','98765','*'],unit:''}];
 const candidate=createReviewCandidate(definition);assert.equal(candidate.validation.valid,false);assert.equal(JSON.stringify(candidate).includes('98765'),false);assert.equal(JSON.stringify(candidate).includes('92835'),false);assert.ok(candidate.validation.errors[0].includes('reauthored'));
 if(process.env.FIRESTORE_EMULATOR_HOST){await enqueueComponentReview(definition);await assert.rejects(updateComponentReview(candidate.id,{action:'approve',expectedVersion:1,syntheticDataConfirmed:true}),/explicit valid edit/);}
});
test('record parameter overflow excludes original numeric literals',()=>{
 const definition={...source(),template:{id:'private_table',type:'table' as const,title:'Private records',reason:'Private request',span:'wide' as const,items:[],recordTool:{columns:Array.from({length:8},(_,i)=>({id:`private_${i}`,label:'Private column'})),outputs:[{id:'private_output',label:'Private result',expression:['private_0','92835','-'],unit:''}]}}};
 const candidate=createReviewCandidate(definition);assert.equal(candidate.validation.valid,false);assert.equal(JSON.stringify(candidate).includes('92835'),false);assert.equal(candidate.definition.template.recordTool,undefined);
});
test('shared candidates retain only controlled simulation aliases for cross-session reuse',()=>{
 const calculator=source();calculator.capabilities=['calculate.area','calculate.private_salary_92835'];calculator.actions=['calculate.area','private_action'];
 const area=createReviewCandidate(calculator);assert.ok(area.definition.capabilities.includes('calculate.area'));assert.ok(area.definition.capabilities.includes('calculate.formula'));assert.deepEqual(area.definition.capabilityBindings,[{capability:'calculate.area',primitiveCapability:'calculate.formula'}]);assert.equal(JSON.stringify(area).includes('private_salary_92835'),false);assert.equal(JSON.stringify(area).includes('private_action'),false);assert.ok(area.validation.valid);
 const form=source();form.template.custom!.outputs=[];form.capabilities=['collect.task_input','calculate.area','collect.private_name'];const collection=createReviewCandidate(form);assert.ok(collection.definition.capabilities.includes('collect.task_input'));assert.equal(collection.definition.capabilities.some(capability=>capability.startsWith('calculate')),false);assert.equal(collection.definition.capabilities.includes('collect.private_name'),false);assert.ok(collection.validation.valid);
 const records={...source(),capabilities:['records.inventory','records.private_people'],template:{id:'stock',type:'table' as const,title:'Private inventory',reason:'Private request',span:'wide' as const,items:[],recordTool:{columns:[{id:'stock',label:'Private stock'},{id:'needed',label:'Private demand'}],outputs:[{id:'shortage',label:'Private gap',expression:['needed','stock','-','0','max'],unit:''}]}}};
 const inventory=createReviewCandidate(records);assert.ok(inventory.definition.capabilities.includes('records.inventory'));assert.equal(inventory.definition.capabilities.includes('records.private_people'),false);assert.ok(inventory.validation.valid);
});
