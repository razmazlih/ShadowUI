import {guestDeviceData,snapshotDeviceData} from '../lib/account-device-data';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountWorkspaceKey,readAccountSyncBase,migrateGuestToAccount,parseWorkspaceSnapshot,readAccountWorkspaces,writeAccountWorkspaces,type WorkspaceStorage} from '../lib/account-workspaces';
function storage(){const values=new Map<string,string>();return {values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}};}
function snapshot(id='workspace',text='guest'){return parseWorkspaceSnapshot({workspaces:[{id,title:text,description:'description',goal:'goal',components:[{id:'notes',type:'notes',title:'Notes',reason:'Capture work',items:[],text}]}],active:id,conversations:{[id]:[{role:'user',content:text}]},sources:{[id]:'demo'}});}
test('guest and separate account snapshots remain isolated after reload and signout',()=>{
 const local=storage();writeAccountWorkspaces(local,null,snapshot('guest'));writeAccountWorkspaces(local,'alice',snapshot('alice'));writeAccountWorkspaces(local,'bob',snapshot('bob'));
 assert.equal(readAccountWorkspaces(local,'alice').active,'alice');assert.equal(readAccountWorkspaces(local,'bob').active,'bob');assert.equal(readAccountWorkspaces(local,null).active,'guest');
 assert.equal(readAccountWorkspaces(local,'unseen').workspaces.length,0);assert.notEqual(accountWorkspaceKey('a/b'),accountWorkspaceKey('a%2Fb'));
});
test('legacy guest data moves to the new account including sources and is removed only after success',()=>{
 const local=storage(),guest=snapshot();local.setItem('shadowui.v1',JSON.stringify(guest));local.setItem('shadowui.sources',JSON.stringify(guest.sources));
 const migrated=migrateGuestToAccount(local,'alice');assert.equal(migrated.active,'workspace');assert.deepEqual(migrated.conversations.workspace,guest.conversations.workspace);assert.equal(migrated.sources.workspace,'demo');
 assert.equal(local.getItem('shadowui.v1'),null);assert.equal(readAccountWorkspaces(local,null).workspaces.length,0);assert.equal(readAccountWorkspaces(local,'alice').workspaces.length,1);
});
test('merging keeps account and guest collisions and both complete playground histories',()=>{
 const local=storage(),account=snapshot('same','account'),guest=snapshot('same','guest');account.conversations.playground=Array.from({length:12},(_,i)=>({role:'user',content:`account ${i}`}));guest.conversations.playground=Array.from({length:12},(_,i)=>({role:'user',content:`guest ${i}`}));guest.undoWorkspaces.same=guest.workspaces[0];
 writeAccountWorkspaces(local,'alice',account);writeAccountWorkspaces(local,null,guest);const merged=migrateGuestToAccount(local,'alice');
 assert.equal(merged.workspaces.length,3);assert.equal(merged.workspaces[0].title,'account');const imported=merged.workspaces.find(w=>w.title==='guest')!;assert.notEqual(imported.id,'same');assert.equal(merged.conversations[imported.id][0].content,'guest');assert.equal(merged.undoWorkspaces[imported.id].id,imported.id);assert.equal(merged.active,imported.id);
 assert.equal(merged.conversations.playground.length,12);assert.ok(Object.values(merged.conversations).some(history=>history.length===12&&history[0].content==='guest 0'));
});
test('failed account save preserves all guest and previous account data',()=>{
 const local=storage();writeAccountWorkspaces(local,null,snapshot('guest'));writeAccountWorkspaces(local,'alice',snapshot('account'));const before=new Map(local.values);
 const failing:WorkspaceStorage={...local,setItem:()=>{throw new Error('quota')}};assert.throws(()=>migrateGuestToAccount(failing,'alice'),/quota/);assert.deepEqual(local.values,before);
});
test('retry after a failed guest clear does not duplicate imported work',()=>{
 const local=storage();writeAccountWorkspaces(local,null,snapshot());const failing:WorkspaceStorage={...local,removeItem:()=>{throw new Error('blocked')}};
 assert.throws(()=>migrateGuestToAccount(failing,'alice'),/blocked/);assert.equal(readAccountWorkspaces(local,'alice').workspaces.length,1);const retried=migrateGuestToAccount(local,'alice');assert.equal(retried.workspaces.length,1);assert.equal(readAccountWorkspaces(local,null).workspaces.length,0);
});
test('malformed snapshot entries recover independently without unsafe keys',()=>{
 const value=snapshot();const result=parseWorkspaceSnapshot({...value,workspaces:[...value.workspaces,{id:'bad'}],conversations:JSON.parse('{"__proto__":[],"workspace":[{"role":"user","content":"safe"}]}')});assert.equal(result.workspaces.length,1);assert.equal(Object.hasOwn(result.conversations,'__proto__'),false);
 const local=storage();local.setItem(accountWorkspaceKey('alice'),'{broken');assert.throws(()=>readAccountWorkspaces(local,'alice'));assert.throws(()=>writeAccountWorkspaces(local,'alice',snapshot()));
});
test('device data retains only allowed valid JSON keys within the byte bound',()=>{
 const parsed=parseWorkspaceSnapshot({deviceData:{'shadowui.browser-schedule.v1.schedule':'{"revision":1}','shadowui.layout.v1:workspace':'{"mode":"fixed"}','shadowui.secret':'"private"','shadowui.layout.v1:bad':'{broken','shadowui.layout.v1:__proto__':'{}','shadowui.layout.v1:huge':JSON.stringify('x'.repeat(300001))}});
 assert.deepEqual(Object.keys(parsed.deviceData!),['shadowui.browser-schedule.v1.schedule','shadowui.layout.v1:workspace']);assert.deepEqual(Object.keys(parseWorkspaceSnapshot(null).deviceData!),[]);
});
test('guest migration remaps layout keys and keeps schedule data with the existing domain id',()=>{
 const local=storage(),account=snapshot('same','account'),guest=snapshot('same','guest');account.deviceData={'shadowui.layout.v1:same':'{"mode":"account"}'};guest.deviceData={'shadowui.layout.v1:same':'{"mode":"guest"}','shadowui.browser-schedule.v1.schedule':'{"revision":3}'};
 writeAccountWorkspaces(local,'alice',account);writeAccountWorkspaces(local,null,guest);const merged=migrateGuestToAccount(local,'alice');const imported=merged.workspaces.find(w=>w.title==='guest')!;
 assert.equal(merged.deviceData!['shadowui.layout.v1:same'],'{"mode":"account"}');assert.equal(merged.deviceData![`shadowui.layout.v1:${imported.id}`],'{"mode":"guest"}');assert.equal(merged.deviceData!['shadowui.browser-schedule.v1.schedule'],'{"revision":3}');assert.deepEqual(readAccountWorkspaces(local,'alice').deviceData,merged.deviceData);
});
test('raw layout density survives parsing, migration and workspace id remapping',()=>{
 const local=storage(),account=snapshot('same','account'),guest=snapshot('same','guest');guest.deviceData={'shadowui.layout.v1:same:density':'comfortable'};
 writeAccountWorkspaces(local,'alice',account);writeAccountWorkspaces(local,null,guest);const migrated=migrateGuestToAccount(local,'alice'),imported=migrated.workspaces.find(w=>w.title==='guest')!;
 assert.equal(migrated.deviceData![`shadowui.layout.v1:${imported.id}:density`],'comfortable');assert.equal(parseWorkspaceSnapshot({deviceData:{'shadowui.layout.v1:x:density':'compact'}}).deviceData!['shadowui.layout.v1:x:density'],'compact');assert.deepEqual(Object.keys(parseWorkspaceSnapshot({deviceData:{'shadowui.layout.v1:x:density':'unexpected'}}).deviceData!),[]);
});
test('presentation preferences survive scoped snapshots, guest reload and colliding account migration',()=>{
 const local=storage(),account=snapshot('same','account'),guest=snapshot('same','guest'),key='shadowui.layout.v1:same:presentation';
 local.setItem(key,'fit');local.setItem('shadowui.device-data.alice.'+key,'vertical');
 account.deviceData=snapshotDeviceData(local,account.workspaces,'alice');
 guest.deviceData=snapshotDeviceData(local,guest.workspaces,null);
 writeAccountWorkspaces(local,'alice',account);writeAccountWorkspaces(local,null,guest);
 assert.equal(readAccountWorkspaces(local,'alice').deviceData![key],'vertical');
 assert.equal(readAccountWorkspaces(local,null).deviceData![key],'fit');
 // A control edit after the snapshot wins on guest reload, then enters migration.
 local.setItem(key,'vertical');
 const reloaded=readAccountWorkspaces(local,null);
 reloaded.deviceData=guestDeviceData(local,reloaded);
 assert.equal(reloaded.deviceData[key],'vertical');
 writeAccountWorkspaces(local,null,reloaded);
 account.deviceData![key]='fit';writeAccountWorkspaces(local,'alice',account);
 const migrated=migrateGuestToAccount(local,'alice'),imported=migrated.workspaces.find(w=>w.title==='guest')!;
 assert.notEqual(imported.id,'same');
 assert.equal(migrated.deviceData![key],'fit');
 assert.equal(migrated.deviceData![`shadowui.layout.v1:${imported.id}:presentation`],'vertical');
 assert.deepEqual(readAccountWorkspaces(local,'alice').deviceData,migrated.deviceData);
});
test('presentation parsing accepts only the two raw supported modes',()=>{
 for(const mode of ['fit','vertical'])assert.equal(parseWorkspaceSnapshot({deviceData:{'shadowui.layout.v1:x:presentation':mode}}).deviceData!['shadowui.layout.v1:x:presentation'],mode);
 for(const mode of ['other','"fit"','{}','null'])assert.deepEqual(Object.keys(parseWorkspaceSnapshot({deviceData:{'shadowui.layout.v1:x:presentation':mode}}).deviceData!),[]);
});
test('schedule domain collisions preserve separate schedules including undo and replay history',()=>{
 const local=storage(),account=snapshot('same','account'),guest=snapshot('same','guest'),domainId='00000000-0000-4000-8000-000000000001',prefix='shadowui.browser-schedule.v1.';
 account.workspaces[0].domain={kind:'schedule',id:domainId};guest.workspaces[0].domain={kind:'schedule',id:domainId};guest.undoWorkspaces.same=guest.workspaces[0];
 account.deviceData={[prefix+domainId]:JSON.stringify({schedule:{id:domainId,goal:'account'},history:[],actions:{}})};
 guest.deviceData={[prefix+domainId]:JSON.stringify({schedule:{id:domainId,goal:'guest'},history:[{id:domainId,goal:'before'}],actions:{action:{fingerprint:'saved',result:{id:domainId,goal:'replay'}}}})};
 writeAccountWorkspaces(local,'alice',account);writeAccountWorkspaces(local,null,guest);const migrated=migrateGuestToAccount(local,'alice'),imported=migrated.workspaces.find(w=>w.title==='guest')!,newDomain=imported.domain!.id;
 assert.notEqual(newDomain,domainId);assert.equal(migrated.workspaces[0].domain!.id,domainId);assert.equal(JSON.parse(migrated.deviceData![prefix+domainId]).schedule.goal,'account');const saved=JSON.parse(migrated.deviceData![prefix+newDomain]);assert.equal(saved.schedule.id,newDomain);assert.equal(saved.schedule.goal,'guest');assert.equal(saved.history[0].id,newDomain);assert.equal(saved.actions.action.result.id,newDomain);assert.equal(migrated.undoWorkspaces[imported.id].domain!.id,newDomain);
});

test('snapshot and its cloud baseline share one atomic envelope and survive guest migration',()=>{
 const local=storage(),baseline=snapshot('base'),edited=snapshot('edited');writeAccountWorkspaces(local,'alice',edited,baseline);
 assert.equal(readAccountWorkspaces(local,'alice').active,'edited');assert.equal(readAccountSyncBase(local,'alice').active,'base');
 writeAccountWorkspaces(local,null,snapshot('guest'));migrateGuestToAccount(local,'alice');assert.equal(readAccountSyncBase(local,'alice').active,'base');
 const before=local.getItem(accountWorkspaceKey('alice'));assert.throws(()=>writeAccountWorkspaces({...local,setItem:()=>{throw new Error('quota')}},'alice',snapshot('next'),snapshot('next-base')),/quota/);assert.equal(local.getItem(accountWorkspaceKey('alice')),before);
 // A stale tab persists its own snapshot together with the baseline it edited.
 writeAccountWorkspaces(local,'alice',edited,baseline);assert.equal(readAccountSyncBase(local,'alice').active,'base');assert.equal(readAccountSyncBase(local,'new-user').workspaces.length,0);
});

test('guest reload retains newer control edits while recovering missing envelope data without reading account keys',()=>{
 const local=storage(),guest=snapshot('guest'),layout='shadowui.layout.v1:guest',density=layout+':density',schedule='shadowui.browser-schedule.v1.00000000-0000-4000-8000-000000000001';
 guest.workspaces[0].domain={kind:'schedule',id:'00000000-0000-4000-8000-000000000001'};
 guest.deviceData={[layout]:JSON.stringify({mode:'auto',order:['notes','timer']}),[density]:'comfortable',[schedule]:JSON.stringify({revision:0})};
 writeAccountWorkspaces(local,null,guest);
 // Controls save directly without updating the older workspace envelope.
 const edited=JSON.stringify({mode:'fixed',order:['timer','notes']});
 local.setItem(layout,edited);local.setItem(schedule,JSON.stringify({revision:1}));
 local.setItem('shadowui.device-data.alice.'+density,'compact');
 local.setItem('shadowui.layout.v1:unrelated',JSON.stringify({mode:'fixed'}));
 const reloaded=readAccountWorkspaces(local,null),restored=guestDeviceData(local,reloaded);
 assert.equal(restored[layout],edited);assert.equal(restored[schedule],JSON.stringify({revision:1}));
 assert.equal(restored[density],'comfortable');assert.equal(restored['shadowui.layout.v1:unrelated'],undefined);
 assert.equal(reloaded.deviceData![layout],guest.deviceData[layout]);
 assert.equal(local.getItem('shadowui.device-data.alice.'+density),'compact');
});
