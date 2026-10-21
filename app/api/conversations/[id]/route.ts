import {conversationSharingHandlers} from '@/lib/conversation-sharing';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 return conversationSharingHandlers.GET(request,(await params).id);
}
