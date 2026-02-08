import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Azeroth Dashboard",
  description: "Web dashboard for AzerothCore WoTLK 3.3.5a",
};

const themeScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("theme");d.classList.remove("dark","light");var r;if(t==="light"){r="light"}else if(t==="system"&&!window.matchMedia("(prefers-color-scheme: dark)").matches){r="light"}else{r="dark"}d.classList.add(r);d.style.colorScheme=r;var f=localStorage.getItem("faction");d.classList.remove("faction-alliance","faction-horde","faction-neutral");if(f==="alliance"||f==="horde"||f==="neutral"){d.classList.add("faction-"+f)}var fc={alliance:{dark:{"--color-primary":"#1A6BC4","--color-ring":"#1A6BC4","--color-accent":"#C4A33A","--color-primary-foreground":"#fff"},light:{"--color-primary":"#2563EB","--color-ring":"#2563EB","--color-accent":"#A88B2A","--color-primary-foreground":"#fff"}},horde:{dark:{"--color-primary":"#9B1B1B","--color-ring":"#9B1B1B","--color-accent":"#D4722A","--color-primary-foreground":"#fff"},light:{"--color-primary":"#B91C1C","--color-ring":"#B91C1C","--color-accent":"#C2631E","--color-primary-foreground":"#fff"}}};if(f&&fc[f]){var c=fc[f][r];for(var k in c){d.style.setProperty(k,c[k])}}}catch(e){document.documentElement.classList.add("dark")}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
