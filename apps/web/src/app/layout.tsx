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

const themeScript = `(function(){try{var t=localStorage.getItem("theme");var d=document.documentElement;d.classList.remove("dark","light");if(t==="light"){d.classList.add("light");d.style.colorScheme="light"}else if(t==="system"&&!window.matchMedia("(prefers-color-scheme: dark)").matches){d.classList.add("light");d.style.colorScheme="light"}else{d.classList.add("dark");d.style.colorScheme="dark"}}catch(e){d.classList.add("dark")}})()`;

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
