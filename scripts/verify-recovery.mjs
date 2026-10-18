import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const original=JSON.parse(await readFile('docs/evidence/mcp-flow.json','utf8'));
const saved=[...original.exchanges].reverse().find(exchange=>exchange.response?.result?.structuredContent?.schedule?.receipt)?.response.result.structuredContent.schedule;
assert.ok(saved?.receipt);
const endpoint=process.env.SHADOWUI_EVIDENCE_URL??'http://localhost:3000/api/mcp';
const exchanges=[];async function rpc(id,method,params){const request={jsonrpc:'2.0',id,method,params};const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify(request),signal:AbortSignal.timeout(15000)});const body=await response.json();exchanges.push({request,httpStatus:response.status,response:body});assert.ok(response.ok);return body.result;}
await rpc(1,'initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'ShadowUI recovery evidence host',version:'1.0'}});
await rpc(2,'tools/list',{});
const result=await rpc(3,'tools/call',{name:'inspect_schedule',arguments:{id:saved.id}});
assert.equal(result.isError,false);assert.equal(result.structuredContent.schedule.receipt.id,saved.receipt.id);assert.equal(result.structuredContent.schedule.status,'committed');
await writeFile('docs/evidence/recovery.json',JSON.stringify({capturedAt:new Date().toISOString(),scope:'Reinspection of the prior evidence schedule after the owned development process was stopped and production server started on the same persistent directory.',originalReceipt:saved.receipt.id,recoveredReceipt:result.structuredContent.schedule.receipt.id,verified:true,exchanges},null,2)+'\n');
console.log('Recovered the original persisted receipt through the restarted server. Evidence: docs/evidence/recovery.json');
