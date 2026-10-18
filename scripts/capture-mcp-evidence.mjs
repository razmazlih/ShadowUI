import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const endpoint=process.env.SHADOWUI_EVIDENCE_URL??'http://localhost:3000/api/mcp';
const exchanges=[];let sequence=0;
async function rpc(method,params={},notification=false){const request={jsonrpc:'2.0',...(!notification?{id:++sequence}:{}),method,params};const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify(request),signal:AbortSignal.timeout(15000)});const raw=await response.text();const result=raw?JSON.parse(raw):null;exchanges.push({request,httpStatus:response.status,response:result});assert.ok(response.ok);return result?.result;}
async function tool(name,args){const result=await rpc('tools/call',{name,arguments:args});return result;}
await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'ShadowUI reproducible evidence host',version:'1.0'}});
await rpc('notifications/initialized',{},true);
const discovered=await rpc('tools/list');assert.ok(discovered.tools.some(t=>t.name==='commit_schedule'));
const id=crypto.randomUUID();const goal='Organize next week shifts for six employees, including Daniel. Everyone needs two days off.';
let view=(await tool('create_schedule',{id,goal})).structuredContent;
view=(await tool('update_schedule',{id,expectedRevision:view.schedule.revision,actionId:crypto.randomUUID(),operation:{type:'set_availability',employeeId:'daniel',date:'2026-10-21',unavailable:true}})).structuredContent;
assert.equal(view.evaluation.valid,false);
const blocked=await tool('commit_schedule',{id,expectedRevision:view.schedule.revision,actionId:crypto.randomUUID(),confirmed:true});assert.equal(blocked.isError,true);
const shift='shift-4',employeeId=view.alternatives[shift][0].employeeId;const operation={type:'assign',shiftId:shift,employeeId};
const preview=(await tool('preview_schedule_change',{id,expectedRevision:view.schedule.revision,operation})).structuredContent;assert.equal(preview.evaluation.valid,true);
const unchanged=(await tool('inspect_schedule',{id})).structuredContent;assert.equal(unchanged.schedule.shifts.find(s=>s.id===shift).employeeId,'daniel');
view=(await tool('update_schedule',{id,expectedRevision:view.schedule.revision,actionId:crypto.randomUUID(),operation})).structuredContent;
const commitArguments={id,expectedRevision:view.schedule.revision,actionId:crypto.randomUUID(),confirmed:true};
const committed=(await tool('commit_schedule',commitArguments)).structuredContent;assert.equal(committed.schedule.status,'committed');
const duplicate=(await tool('commit_schedule',commitArguments)).structuredContent;assert.equal(duplicate.schedule.receipt.id,committed.schedule.receipt.id);
const inspected=(await tool('inspect_schedule',{id})).structuredContent;assert.equal(inspected.schedule.receipt.id,committed.schedule.receipt.id);
await mkdir('docs/evidence',{recursive:true});
await writeFile('docs/evidence/mcp-flow.json',JSON.stringify({capturedAt:new Date().toISOString(),endpoint,scope:'Actual loopback HTTP MCP calls. Synthetic roster. Internal server persistence only; no Alexa device or employer connection.',verified:{discovery:true,invalidCommitRejected:true,previewDidNotMutate:true,validCommitPersisted:true,duplicateCommitReusedReceipt:true,receiptRecovered:true},exchanges},null,2)+'\n');
console.log(`Verified ${exchanges.length} HTTP exchanges; persisted receipt ${committed.schedule.receipt.id}. Evidence: docs/evidence/mcp-flow.json`);
