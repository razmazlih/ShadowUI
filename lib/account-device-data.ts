import type {WorkspaceSnapshot} from './account-workspaces';
/** Account-specific auxiliary storage. UID comes only from the verified auth observer. */
let owner:string|null=null;
export function setDeviceDataOwner(uid:string|null){owner=uid;}
function key(value:string){return owner?`shadowui.device-data.${encodeURIComponent(owner)}.${value}`:value;}
export function deviceDataStorage(storage:Storage=window.localStorage){return {getItem:(name:string)=>storage.getItem(key(name)),setItem:(name:string,value:string)=>storage.setItem(key(name),value),removeItem:(name:string)=>storage.removeItem(key(name))};}
export function snapshotDeviceData(storage:Pick<Storage,'getItem'>,workspaces:Array<{id:string;domain?:{id:string}}>,uid:string|null=owner):Record<string,string>{
 const result:Record<string,string>={};const scoped={getItem:(name:string)=>storage.getItem(uid?`shadowui.device-data.${encodeURIComponent(uid)}.${name}`:name)};
 for(const workspace of workspaces)for(const name of [`shadowui.layout.v1:${workspace.id}`,`shadowui.layout.v1:${workspace.id}:density`,...(workspace.domain?[`shadowui.browser-schedule.v1.${workspace.domain.id}`]:[])]){const raw=scoped.getItem(name);if(raw!==null)result[name]=raw;}
 return result;
}
export function restoreDeviceData(storage:Storage,data:Record<string,string>={},previous:Record<string,string>={}){const scoped=deviceDataStorage(storage);for(const name of Object.keys(previous))if(!Object.hasOwn(data,name))scoped.removeItem(name);for(const [name,value] of Object.entries(data))scoped.setItem(name,value);}

/** Guest controls persist directly; their newest local values precede an older envelope. */
export function guestDeviceData(storage:Pick<Storage,'getItem'>,snapshot:WorkspaceSnapshot):Record<string,string>{
 return {...snapshot.deviceData,...snapshotDeviceData(storage,snapshot.workspaces,null)};
}
