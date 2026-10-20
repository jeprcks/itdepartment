import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/sidebar";
import SidebarFrame from "@/components/sidebar-frame";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IT Department",
  description: "IT Department Projects Management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full min-h-full">
        <SidebarFrame>
          <Suspense
            fallback={
              <aside className="h-dvh w-56 shrink-0 bg-[#193956]" />
            }
          >
            <Sidebar />
          </Suspense>
        </SidebarFrame>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
