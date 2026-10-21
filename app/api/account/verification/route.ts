import {getAuth} from 'firebase-admin/auth';
import {catalogDatabase,firebaseApp} from '@/lib/firebase-admin';
import {buildVerificationEmail} from '@/lib/verification-email';
export const runtime='nodejs';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 // Keep Firebase delivery available until a custom sender is configured.
 if(!process.env.RESEND_API_KEY||!process.env.VERIFICATION_EMAIL_FROM||!process.env.APP_URL)return reply({fallback:true},503);
 const origin=new URL(process.env.APP_URL).origin;
 if(request.headers.get('origin')!==origin)return reply({error:'בקשה לא מורשית.'},403);
 const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
 if(!token)return reply({error:'יש להתחבר תחילה.'},401);
 const auth=getAuth(firebaseApp());
 let identity;
 try{identity=await auth.verifyIdToken(token,true);}catch{return reply({error:'יש להתחבר שוב.'},401);}
 try{
  const user=await auth.getUser(identity.uid);
  if(user.emailVerified)return reply({verified:true});
  if(!user.email)return reply({error:'לחשבון אין כתובת אימייל.'},400);
  const ref=catalogDatabase().collection('shadowui_verification_mail').doc(user.uid);
  const allowed=await catalogDatabase().runTransaction(async tx=>{
   const previous=await tx.get(ref);const now=Date.now();
   if(now-Number(previous.data()?.sentAt??0)<60_000)return false;
   tx.set(ref,{sentAt:now});return true;
  });
  if(!allowed)return reply({error:'המתינו דקה לפני שליחת אימות נוסף.'},429);
  const generated=new URL(await auth.generateEmailVerificationLink(user.email));
  const code=generated.searchParams.get('oobCode');if(!code)throw new Error('Missing action code');
  const url=new URL('/auth/verify',origin);url.searchParams.set('mode','verifyEmail');url.searchParams.set('oobCode',code);
  const mail=buildVerificationEmail(url.toString());
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.VERIFICATION_EMAIL_FROM,to:[user.email],...mail}),signal:AbortSignal.timeout(15_000)});
  if(!sent.ok)throw new Error('Mail provider rejected delivery');
  return reply({sent:true});
 }catch{return reply({error:'לא ניתן לשלוח את מייל האימות כרגע. נסו שוב בעוד דקה.'},502);}
}
