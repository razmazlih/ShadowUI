import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { POST, GET } from '../app/api/mcp/route';
const call=(body:unknown,headers:Record<string,string>={})=>POST(new Request('http://localhost:3000/api/mcp',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));
test('MCP initialization, tool discovery and invocation',async()=>{
 const init=await (await call({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}})).json();
 assert.equal(init.result.protocolVersion,'2025-11-25');
 const listed=await (await call({jsonrpc:'2.0',id:2,method:'tools/list'})).json();
 assert.equal(listed.result.tools.length,7);
 const composed=await (await call({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'compose_workspace',arguments:{prompt:'Compare three community projects'}}})).json();
 assert.equal(composed.result.isError,false);
 const plan=JSON.parse(composed.result.content[0].text);
 const validated=await (await call({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'validate_workspace',arguments:{workspace:plan.workspace}}})).json();
 assert.equal(JSON.parse(validated.result.content[0].text).valid,true);
});
test('MCP rejects cross-origin requests and unsupported methods',async()=>{
 assert.equal((await call({jsonrpc:'2.0',id:1,method:'tools/list'},{Origin:'https://evil.example'})).status,403);
 assert.equal((await GET()).status,405);
 assert.equal((await call({jsonrpc:'2.0',method:'notifications/initialized'})).status,202);
 const invalid=await (await call({jsonrpc:'2.0',id:9,method:'tools/call',params:{name:'compose_workspace',arguments:{prompt:''}}})).json();
 assert.equal(invalid.error.code,-32602);
});

test('MCP schedule tools execute persistence, constraints, preview, repair and commit',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'shadow-mcp-'));process.env.SHADOWUI_DATA_DIR=dir;
 const invoke=async(name:string,args:unknown)=>{const response=await call({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args}});return (await response.json()).result;};
 try{const created=await invoke('create_schedule',{id:'mcp-flow',goal:'Schedule six employees'});assert.equal(created.structuredContent.schedule.revision,0);
 const op={type:'set_availability',employeeId:created.structuredContent.schedule.shifts[4].employeeId,date:created.structuredContent.schedule.shifts[4].date,unavailable:true};const changed=await invoke('update_schedule',{id:'mcp-flow',expectedRevision:0,actionId:'availability',operation:op});assert.ok(changed.structuredContent.evaluation.conflicts.some((c:{code:string})=>c.code==='UNAVAILABLE'));
 const employeeId=changed.structuredContent.alternatives['shift-4'][0].employeeId;const assignment={type:'assign',shiftId:'shift-4',employeeId};const preview=await invoke('preview_schedule_change',{id:'mcp-flow',expectedRevision:1,operation:assignment});assert.ok(preview.structuredContent.evaluation.valid);assert.equal((await invoke('inspect_schedule',{id:'mcp-flow'})).structuredContent.schedule.revision,1);
 await invoke('update_schedule',{id:'mcp-flow',expectedRevision:1,actionId:'repair',operation:assignment});const committed=await invoke('commit_schedule',{id:'mcp-flow',expectedRevision:2,actionId:'commit',confirmed:true});assert.equal(committed.structuredContent.schedule.status,'committed');assert.ok(committed.structuredContent.schedule.receipt.id);
 const stale=await invoke('update_schedule',{id:'mcp-flow',expectedRevision:0,actionId:'stale',operation:op});assert.equal(stale.isError,true);assert.equal(stale.structuredContent.code,'STALE_REVISION');
 const invalid=await invoke('commit_schedule',{id:'mcp-flow',expectedRevision:3,actionId:'bad',confirmed:false});assert.equal(invalid.structuredContent.code,'INVALID_INPUT');
 }finally{delete process.env.SHADOWUI_DATA_DIR;await rm(dir,{recursive:true,force:true});}
});
test('local schedule MCP rejects public Host headers',async()=>{const response=await call({jsonrpc:'2.0',id:1,method:'tools/list'},{Host:'public.example'});assert.equal(response.status,403);const allowed=await call({jsonrpc:'2.0',id:1,method:'tools/list'},{Host:'127.0.0.1:3000'});assert.equal(allowed.status,200);});
