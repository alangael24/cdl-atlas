import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'CDL Atlas',statusBarStyle:'default'},icons:{icon:'/favicon.svg',apple:'/app-icon-192.png'},title:'CDL Atlas — Aprende cada parte. Domina tu pre-trip.',description:'Explora un tractocamión 3D y practica la inspección pre-trip con explicaciones en español y frases en inglés.'};
export const viewport: Viewport = {width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#304f3c'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="es"><body>{children}</body></html>}
