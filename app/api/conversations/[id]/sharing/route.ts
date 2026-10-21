import {conversationSharingHandlers} from '@/lib/conversation-sharing';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 return conversationSharingHandlers.GET_SHARING(request,(await params).id);
}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
 return conversationSharingHandlers.PUT_SHARING(request,(await params).id);
}
