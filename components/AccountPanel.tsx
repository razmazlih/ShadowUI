'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {AnimatePresence,LayoutGroup,motion,useIsPresent,useReducedMotion} from 'motion/react';
import type {User} from 'firebase/auth';
import {useRouter} from 'next/navigation';
import {KeyRound,LogIn,UserPlus} from 'lucide-react';
import {accountAuthError,addAccountPassword,firebaseClientConfigured,linkAccountGoogle,observeAccountUser,refreshAccountVerification,registerAccount,resendAccountVerification,resetAccountPassword,signInAccountEmail,signInAccountGoogle,signOutAccount} from '@/lib/firebase-client';
import styles from './AccountPanel.module.css';

const english:Record<string,string>={
 "חשבון ושמירת שיחות": "Account and saved conversations",
 "בחירת כניסה או הרשמה": "Choose sign in or sign up",
 "כניסה לחשבון": "Sign in",
 "יצירת חשבון": "Create account",
 "טוענים את החשבון…": "Loading your account…",
 "עוד רגע אפשר יהיה להמשיך.": "You can continue in a moment.",
 "ממשיכים כאורח.": "Continue as a guest.",
 "השיחות נשמרות כאורח במכשיר זה. התחברות לחשבון תהיה זמינה לאחר הגדרת Firebase באתר.": "Guest conversations are saved on this device. Sign in will be available once Firebase is configured.",
 "החשבון שלכם": "Your account",
 "עוד צעד אחד": "One more step",
 "הכול במקום אחד.": "Everything in one place.",
 "אמתו את האימייל.": "Verify your email.",
 "כאן מנהלים את שיטות ההתחברות לאותו חשבון.": "Manage sign-in methods for your account here.",
 "פתחו את קישור האימות שנשלח אליכם. כשתחזרו לכאן, נמשיך אוטומטית.": "Open the verification link in your email. Return here to continue automatically.",
 "לאחר האימות, שיחות האורח ישויכו לחשבון. בינתיים אפשר להמשיך לעבוד כאורח.": "After verification, your guest conversations will be linked to your account. You can keep working as a guest meanwhile.",
 "האימייל עדיין לא אומת. פתחו את הקישור שקיבלתם ואז לחצו שוב.": "Your email is not verified yet. Open the link you received, then try again.",
 "האימייל אומת והחשבון מוכן.": "Your email is verified and your account is ready.",
 "אימתתי את האימייל · המשך": "I verified my email · Continue",
 "הודעת האימות נשלחה. בדקו גם את תיקיית הספאם.": "Verification email sent. Please also check your spam folder.",
 "שליחת קישור אימות נוסף": "Resend verification link",
 "הסיסמה נוספה. אפשר להתחבר לאותו חשבון גם עם Google וגם עם אימייל וסיסמה.": "Password added. You can sign in to this account with Google or email and password.",
 "הוספת סיסמה לאותו חשבון": "Add a password to this account",
 "לפחות 6 תווים. הסיסמה תתווסף לחשבון Google הקיים.": "At least 6 characters. The password will be added to your existing Google account.",
 "הוספת סיסמה לחשבון": "Add password",
 "Google קושר לאותו חשבון ולאותן שיחות.": "Google is linked to this account and its conversations.",
 "קישור Google לאותו אימייל": "Link Google to this email",
 "יצאת מהחשבון. השיחות שלו שמורות במכשיר ויופיעו כשתתחברו אליו שוב.": "Signed out. Your conversations are saved on this device and will appear when you sign in again.",
 "יציאה מהחשבון": "Sign out",
 "חזרה לחשבון": "Return to your account",
 "איפוס סיסמה.": "Reset password.",
 "נשלח לאימייל שלכם קישור לבחירת סיסמה חדשה.": "We will email you a link to choose a new password.",
 "אם קיים חשבון מתאים, יישלח אליו קישור לאיפוס סיסמה. בדקו גם את תיקיית הספאם.": "If a matching account exists, a password reset link will be sent. Please also check your spam folder.",
 "האימייל של החשבון": "Account email",
 "שליחת קישור לאיפוס סיסמה": "Send password reset link",
 "חזרה לכניסה לחשבון": "Back to sign in",
 "יצירת חשבון חדש": "Create your account",
 "השיחות שלכם, שמורות בכל מכשיר.": "Your conversations, saved across devices.",
 "חוזרים לשיחות ולסביבות העבודה שלכם.": "Return to your conversations and workspaces.",
 "יצירת חשבון עם Google": "Sign up with Google",
 "כניסה עם Google": "Sign in with Google",
 "או באמצעות אימייל": "or with email",
 "החשבון נוצר. נשלח קישור לאימות האימייל.": "Account created. A verification link has been sent to your email.",
 "התחברתם לחשבון.": "You are signed in.",
 "כתובת אימייל": "Email address",
 "בחרו סיסמה": "Choose a password",
 "סיסמה": "Password",
 "שכחתם סיסמה?": "Forgot password?",
 "לפחות 6 תווים. נשלח לכם קישור לאימות האימייל.": "At least 6 characters. We will send you an email verification link.",
 "יצירת חשבון ושליחת אימות": "Create account and send verification",
 "כניסה עם אימייל וסיסמה": "Sign in with email and password",
 "מבצע את הבקשה…": "Working on your request…"
};

type AuthMode='login'|'register'|'reset';
function AccountStep({children,direction,reducedMotion,view}:{children:ReactNode;direction:number;reducedMotion:boolean;view:string}){
 const present=useIsPresent();
 const variants={
  enter:(travel:number)=>reducedMotion?{opacity:1,x:0,y:0,scale:1,rotateY:0,filter:'blur(0px)'}:{opacity:0,x:travel*24,y:8,scale:.975,rotateY:travel*-4,filter:'blur(5px)'},
  visible:{opacity:1,x:0,y:0,scale:1,rotateY:0,filter:'blur(0px)',transition:{duration:reducedMotion?0:.44,ease:[.22,1,.36,1] as [number,number,number,number]}},
  exit:(travel:number)=>({opacity:reducedMotion?1:0,x:reducedMotion?0:travel*-16,y:reducedMotion?0:-4,scale:reducedMotion?1:.985,rotateY:reducedMotion?0:travel*2,filter:reducedMotion?'blur(0px)':'blur(3px)',transition:{duration:reducedMotion?0:.18,ease:'easeIn' as const}}),
 };
 return <motion.div className={styles.step} data-auth-mode={view} inert={!present} aria-hidden={!present||undefined} custom={direction} variants={variants} initial={false} animate="visible" exit="exit" style={{transformPerspective:700,transformStyle:'preserve-3d'}}>{children}</motion.div>;
}
export default function AccountPanel({onUser=()=>{},disabled=false,locale='he'}:{locale?:'he'|'en';onUser?:(user:User|null)=>void;disabled?:boolean}){
 const t=(text:string)=>locale==='en'?(english[text]??text):text;
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(firebaseClientConfigured),[mode,setMode]=useState<AuthMode>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[working,setWorking]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const router=useRouter();
 const completingSignIn=useRef(false);
 const callback=useRef(onUser);callback.current=onUser;
 const localeRef=useRef(locale);localeRef.current=locale;
 const loginButton=useRef<HTMLButtonElement>(null);
 const [direction,setDirection]=useState(1);
 const groupId=useId();
 const content=useRef<HTMLDivElement>(null);
 const [contentHeight,setContentHeight]=useState<number>();
 useEffect(()=>{const element=content.current;if(!element)return;const observer=new ResizeObserver(()=>setContentHeight(element.offsetHeight));observer.observe(element);return()=>observer.disconnect();},[]);
 const reducedMotion=Boolean(useReducedMotion());
 useEffect(()=>observeAccountUser(next=>{setUser(next);setLoading(false);callback.current(next);if(completingSignIn.current&&next?.emailVerified)router.replace('/');},failure=>{setError(accountAuthError(failure,localeRef.current));setLoading(false);}),[]);
 // Verify automatically when returning from the email link, including another tab.
 useEffect(()=>{
  if(!user||user.emailVerified)return;
  let cancelled=false,pending=false;
  async function check(){
   if(document.visibilityState!=='visible'||pending)return;
   pending=true;
   try{const next=await refreshAccountVerification();if(!cancelled&&next?.emailVerified)router.replace('/');}
   catch{/* Keep the explicit refresh and resend controls available on failure. */}
   finally{pending=false;}
  }
  const onVisible=()=>{void check();};
  window.addEventListener('focus',onVisible);document.addEventListener('visibilitychange',onVisible);
  const timer=window.setInterval(onVisible,5000);
  return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener('focus',onVisible);document.removeEventListener('visibilitychange',onVisible);};
 },[user?.uid,user?.emailVerified,router]);
 async function signIn(operation:()=>Promise<unknown>){
  completingSignIn.current=true;
  try{return await operation();}finally{completingSignIn.current=false;}
 }
 const locked=working||disabled||loading;
 async function run(operation:()=>Promise<unknown>,success=''){
  if(locked)return;
  setWorking(true);setError('');setMessage('');
  try{await operation();setPassword('');setMessage(success);}
  catch(failure){setError(accountAuthError(failure,locale));}
  finally{setWorking(false);}
 }
 function changeMode(next:AuthMode){
  if(locked)return;
  setDirection(next==='register'||next==='reset'?1:-1);setMode(next);setPassword('');setError('');setMessage('');
  if(next==='reset'||mode==='reset')loginButton.current?.focus();
 }
 const hasPassword=user?.providerData.some(provider=>provider.providerId==='password');
 const register=mode==='register';
 const screen=!firebaseClientConfigured?'guest':user?(user.emailVerified?'account':'verify'):mode;
 return <section className={styles.account} dir={locale==='he'?'rtl':'ltr'} aria-label={t("חשבון ושמירת שיחות")} aria-busy={loading||working}>
  <div id="account-panel" className={styles.panel}>
   {!user&&firebaseClientConfigured&&<LayoutGroup id={groupId}><div className={styles.modes} data-auth-mode-switch role="group" aria-label={t("בחירת כניסה או הרשמה")}>
    <button ref={loginButton} type="button" disabled={locked} aria-pressed={mode==='login'||mode==='reset'} onClick={()=>changeMode('login')}>{!register&&<motion.span className={styles.activePill} layoutId="auth-mode-pill" transition={reducedMotion?{duration:0}:{type:"spring",stiffness:380,damping:28}} aria-hidden="true"/>}<span className={styles.modeLabel}>{t("כניסה לחשבון")}</span></button>
    <button type="button" disabled={locked} aria-pressed={register} onClick={()=>changeMode('register')}>{register&&<motion.span className={styles.activePill} layoutId="auth-mode-pill" transition={reducedMotion?{duration:0}:{type:"spring",stiffness:380,damping:28}} aria-hidden="true"/>}<span className={styles.modeLabel}>{t("יצירת חשבון")}</span></button>
   </div></LayoutGroup>}
   <motion.div className={styles.transition} initial={false} animate={{height:contentHeight??"auto"}} transition={{height:{duration:reducedMotion?0:.24,ease:[.22,1,.36,1]}}}><div ref={content}>
    <AnimatePresence mode="wait" initial={false} custom={direction}>
     <AccountStep key={screen} view={screen} direction={direction} reducedMotion={reducedMotion}>
      {screen==='guest'?<><h1 className={styles.heading}>{t("ממשיכים כאורח.")}</h1><p role="status">{t("השיחות נשמרות כאורח במכשיר זה. התחברות לחשבון תהיה זמינה לאחר הגדרת Firebase באתר.")}</p></>:user?<>
       <div className={styles.intro}><span className={styles.kicker}>{user.emailVerified?t("החשבון שלכם"):t("עוד צעד אחד")}</span><h1 className={styles.heading}>{user.emailVerified?t("הכול במקום אחד."):t("אמתו את האימייל.")}</h1><p>{user.emailVerified?t("כאן מנהלים את שיטות ההתחברות לאותו חשבון."):t("פתחו את קישור האימות שנשלח אליכם. כשתחזרו לכאן, נמשיך אוטומטית.")}</p></div>
       <p className={styles.identity} dir="auto">{user.email}</p>
       {!user.emailVerified&&<>
        <p className={styles.hint}>{t("לאחר האימות, שיחות האורח ישויכו לחשבון. בינתיים אפשר להמשיך לעבוד כאורח.")}</p>
        <button className={styles.primary} type="button" disabled={locked} onClick={()=>void run(async()=>{const next=await refreshAccountVerification();if(!next?.emailVerified)throw new Error(t("האימייל עדיין לא אומת. פתחו את הקישור שקיבלתם ואז לחצו שוב."));router.replace('/');},t("האימייל אומת והחשבון מוכן."))}>{t("אימתתי את האימייל · המשך")}</button>
        <button className={styles.secondary} type="button" disabled={locked} onClick={()=>void run(resendAccountVerification,t("הודעת האימות נשלחה. בדקו גם את תיקיית הספאם."))}>{t("שליחת קישור אימות נוסף")}</button>
       </>}
       {user.emailVerified&&!hasPassword&&user.providerData.some(provider=>provider.providerId==='google.com')&&<form onSubmit={event=>{event.preventDefault();void run(()=>addAccountPassword(password),t("הסיסמה נוספה. אפשר להתחבר לאותו חשבון גם עם Google וגם עם אימייל וסיסמה."));}}>
        <label htmlFor="account-add-password">{t("הוספת סיסמה לאותו חשבון")}</label>
        <input id="account-add-password" dir="ltr" type="password" autoComplete="new-password" aria-describedby="account-add-password-hint" value={password} onChange={event=>setPassword(event.target.value)} minLength={6} maxLength={4096} required disabled={locked}/>
        <p id="account-add-password-hint" className={styles.hint}>{t("לפחות 6 תווים. הסיסמה תתווסף לחשבון Google הקיים.")}</p>
        <button className={styles.primary} disabled={locked}>{t("הוספת סיסמה לחשבון")}</button>
       </form>}
       {user.emailVerified&&!user.providerData.some(provider=>provider.providerId==='google.com')&&<button className={styles.primary} type="button" disabled={locked} onClick={()=>void run(linkAccountGoogle,t("Google קושר לאותו חשבון ולאותן שיחות."))}>{t("קישור Google לאותו אימייל")}</button>}
       <button className={styles.secondary} type="button" disabled={locked} onClick={()=>void run(signOutAccount,t("יצאת מהחשבון. השיחות שלו שמורות במכשיר ויופיעו כשתתחברו אליו שוב."))}>{t("יציאה מהחשבון")}</button>
      </>:mode==='reset'?<>
       <div className={styles.intro}><span className={styles.kicker}>{t("חזרה לחשבון")}</span><div className={styles.titleRow}><motion.span className={styles.modeIcon} initial={reducedMotion?false:{scale:.6,rotate:-25}} animate={{scale:1,rotate:0}} transition={reducedMotion?{duration:0}:{type:'spring',stiffness:320,damping:19,delay:.05}} aria-hidden="true"><KeyRound size={16}/></motion.span><h1 className={styles.heading}>{t("איפוס סיסמה.")}</h1></div><p>{t("נשלח לאימייל שלכם קישור לבחירת סיסמה חדשה.")}</p></div>
       <form onSubmit={event=>{event.preventDefault();void run(()=>resetAccountPassword(email),t("אם קיים חשבון מתאים, יישלח אליו קישור לאיפוס סיסמה. בדקו גם את תיקיית הספאם."));}}>
        <label htmlFor="account-reset-email">{t("האימייל של החשבון")}</label>
        <input id="account-reset-email" dir="ltr" type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} maxLength={254} placeholder="you@example.com" required disabled={locked}/>
        <button className={styles.primary} disabled={locked}>{t("שליחת קישור לאיפוס סיסמה")}</button>
       </form>
       <button className={styles.textButton} type="button" disabled={locked} onClick={()=>changeMode('login')}>{t("חזרה לכניסה לחשבון")}</button>
      </>:<>
       <div className={styles.intro}><div className={styles.titleRow}><motion.span className={styles.modeIcon} initial={reducedMotion?false:{scale:.6,rotate:register?25:-25}} animate={{scale:1,rotate:0}} transition={reducedMotion?{duration:0}:{type:'spring',stiffness:320,damping:19,delay:.05}} aria-hidden="true">{register?<UserPlus size={16}/>:<LogIn size={16}/>}</motion.span><h1 className={styles.heading}>{register?t("יצירת חשבון חדש"):t("כניסה לחשבון")}</h1></div><p>{register?t("השיחות שלכם, שמורות בכל מכשיר."):t("חוזרים לשיחות ולסביבות העבודה שלכם.")}</p></div>
       <button className={styles.google} type="button" disabled={locked} onClick={()=>void run(()=>signIn(signInAccountGoogle))}><span className={styles.googleMark} aria-hidden="true">G</span>{register?t("יצירת חשבון עם Google"):t("כניסה עם Google")}</button>
       <div className={styles.divider}><span>{t("או באמצעות אימייל")}</span></div>
       <form onSubmit={event=>{event.preventDefault();void run(()=>signIn(()=>register?registerAccount(email,password):signInAccountEmail(email,password)),register?t("החשבון נוצר. נשלח קישור לאימות האימייל."):t("התחברתם לחשבון."));}}>
        <label htmlFor="account-email">{t("כתובת אימייל")}</label>
        <input id="account-email" dir="ltr" type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} maxLength={254} placeholder="you@example.com" required disabled={locked}/>
        <div className={styles.passwordLabel}><label htmlFor="account-password">{register?t("בחרו סיסמה"):t("סיסמה")}</label>{!register&&<button className={styles.textButton} type="button" disabled={locked} onClick={()=>changeMode('reset')}>{t("שכחתם סיסמה?")}</button>}</div>
        <input id="account-password" dir="ltr" type="password" autoComplete={register?'new-password':'current-password'} aria-describedby={register?'account-password-hint':undefined} value={password} onChange={event=>setPassword(event.target.value)} minLength={register?6:1} maxLength={4096} required disabled={locked}/>
        {register&&<p id="account-password-hint" className={styles.hint}>{t("לפחות 6 תווים. נשלח לכם קישור לאימות האימייל.")}</p>}
        <button className={styles.primary} disabled={locked}>{register?t("יצירת חשבון ושליחת אימות"):t("כניסה עם אימייל וסיסמה")}</button>
       </form>
      </>}
     </AccountStep>
    </AnimatePresence>
   </div></motion.div>
   {working&&<p className={styles.feedback} role="status">{t("מבצע את הבקשה…")}</p>}
   {message&&<p className={styles.feedback} role="status">{message}</p>}
   {error&&<p className={styles.error} role="alert">{error}</p>}
  </div>
 </section>;
}
