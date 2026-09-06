import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'CDL Atlas',statusBarStyle:'default'},icons:{icon:'/favicon.svg',apple:'/app-icon-192.png'},title:'CDL Atlas — Pre-trip y exámenes en español',description:'Estudia tu CDL en español: camión 3D, inspección pre-trip y preguntas de práctica con explicaciones y audio.'};
export const viewport: Viewport = {width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#304f3c'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="es"><body>{children}</body></html>}
