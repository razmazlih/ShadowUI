import AuthScreen from '@/components/AuthScreen';
export const metadata={title:'Sign in / הרשמה · ShadowUI'};
export default async function AuthPage({searchParams}:{searchParams:Promise<{lang?:string;mode?:string;returnTo?:string}>}){
 const {lang,mode,returnTo}=await searchParams;
 return <AuthScreen initialLocale={lang==='en'?'en':'he'} initialMode={mode==='register'?'register':'login'} returnTo={returnTo}/>;
}
