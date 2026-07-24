import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import {Toaster} from "@/components/ui/sonner";
import {TooltipProvider} from "@/components/ui/tooltip";
import {QueryProvider} from "@/components/providers/query-provider";

const geistSans = Geist({
 variable: "--font-geist-sans",
 subsets: ["latin"],
});

const geistMono = Geist_Mono({
 variable: "--font-geist-mono",
 subsets: ["latin"],
});

export const metadata: Metadata = {
 title: { default: "GymOS", template: "%s · GymOS" },
 description: "Gym management software for the Indian market.",
};

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
  <html
   lang="en"
   className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
  >
   <body className="min-h-full flex flex-col" suppressHydrationWarning>
    <QueryProvider>
     <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
    </QueryProvider>
    <Toaster richColors position="top-right" />
   </body>
  </html>
 );
}
