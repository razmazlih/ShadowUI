import AuthScreen from '@/components/AuthScreen';
export const metadata={title:'Sign in / הרשמה · ShadowUI'};
export default async function AuthPage({searchParams}:{searchParams:Promise<{lang?:string}>}){
 const {lang}=await searchParams;
 return <AuthScreen initialLocale={lang==='en'?'en':'he'}/>;
}
