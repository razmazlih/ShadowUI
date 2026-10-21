import SharedConversation from '@/components/SharedConversation';
export default async function ConversationPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <SharedConversation id={id}/>;}
