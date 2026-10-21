import type {Page} from '@playwright/test';
import type {WorkspaceSnapshot} from '../../../lib/account-workspaces';

/** Browser tests are signed-out guests; read the same envelope used by the app. */
export async function guestSnapshot(page:Page):Promise<WorkspaceSnapshot>{
 return page.evaluate(()=>{
  const raw=localStorage.getItem('shadowui.device.v1.guest');
  if(!raw)throw new Error('Expected the app to persist its guest workspace envelope');
  return JSON.parse(raw).snapshot;
 });
}

export async function activeWorkspaceId(page:Page){return (await guestSnapshot(page)).active;}
export async function guestWorkspaces(page:Page){return (await guestSnapshot(page)).workspaces;}
export async function activeWorkspace(page:Page){
 const snapshot=await guestSnapshot(page);
 const workspace=snapshot.workspaces.find(item=>item.id===snapshot.active);
 if(!workspace)throw new Error('Expected an active persisted guest workspace');
 return workspace;
}
