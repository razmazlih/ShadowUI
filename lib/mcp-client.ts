import {deviceDataStorage} from './account-device-data';
import {BrowserScheduleStore,browserScheduleTools} from './browser-schedule-store';
import {ScheduleError} from './schedule';
export class MCPError extends Error {constructor(message:string,public code:string){super(message);this.name='MCPError';}}
export type MCPTrace={method:string;tool?:string;at:string;status:'ok'|'error';requestId:string};
export class MCPClient {
 private ready:Promise<void>|null=null;private sequence=0;private version='2025-11-25';private session:string|null=null;
 get browserLocal(){return typeof window!=='undefined'&&!['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);}
 public traces:MCPTrace[]=[];public tools:string[]=[];
 constructor(private endpoint='/api/mcp'){}
 private async request(method:string,params:Record<string,unknown>={},notification=false):Promise<any>{
  const id=String(++this.sequence);const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':this.version,...(this.session?{'Mcp-Session-Id':this.session}:{})},body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id}),method,params}),signal:controller.signal});
  const session=response.headers.get('mcp-session-id');if(session)this.session=session;
  if(!response.ok)throw new Error(`MCP request failed (${response.status})`);
  if(notification){this.traces.push({method,at:new Date().toISOString(),status:'ok',requestId:id});return;}
  const message=await response.json();if(message.error)throw new MCPError(message.error.message||'MCP protocol error',String(message.error.code));if(message.result?.isError){let failure=message.result.structuredContent;try{failure??=JSON.parse(message.result.content?.find((item:{type:string})=>item.type==='text')?.text??'{}')}catch{}throw new MCPError(failure?.message||'MCP tool failed',failure?.code||'TOOL_ERROR');}
  this.traces.push({method,tool:typeof params.name==='string'?params.name:undefined,at:new Date().toISOString(),status:'ok',requestId:id});return message.result;
  }catch(error){this.traces.push({method,tool:typeof params.name==='string'?params.name:undefined,at:new Date().toISOString(),status:'error',requestId:id});throw error instanceof Error?error:new Error('MCP connection failed')}finally{clearTimeout(timeout)}
 }
 async connect(){if(this.browserLocal){this.tools=[...browserScheduleTools];return;}if(!this.ready)this.ready=(async()=>{const initialized=await this.request('initialize',{protocolVersion:this.version,capabilities:{},clientInfo:{name:'ShadowUI web host',version:'1.0.0'}});this.version=initialized.protocolVersion;await this.request('notifications/initialized',{},true);const discovered=await this.request('tools/list');this.tools=discovered.tools.map((tool:{name:string})=>tool.name)})().catch(error=>{this.ready=null;throw error});await this.ready}
 async call<T>(name:string,args:Record<string,unknown>):Promise<T>{if(this.browserLocal){try{return new BrowserScheduleStore(deviceDataStorage()).call(name,args) as T;}catch(error){if(error instanceof ScheduleError)throw new MCPError(error.message,error.code);throw error;}}await this.connect();if(!this.tools.includes(name))throw new Error(`The server has not exposed ${name}. Refresh after updating the server.`);const result=await this.request('tools/call',{name,arguments:args});const text=result.content?.find((item:{type:string})=>item.type==='text')?.text;let output=result.structuredContent;try{output??=JSON.parse(text??'{}')}catch{if(result.isError)throw new Error(text||'Tool failed');throw new Error('Tool returned invalid structured data')}if(result.isError)throw new Error(output?.message||output?.error||text||'Tool action failed');return output as T;}
}
