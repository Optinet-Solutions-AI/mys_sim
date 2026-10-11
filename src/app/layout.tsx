import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mystery Box Simulator",
  description: "A research sandbox for mystery-box mechanics: labs, algorithms, rigs and detection.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="mx-auto flex min-h-screen max-w-[1400px]">
          <Suspense fallback={<aside className="hidden w-60 shrink-0 border-r border-line bg-surface md:block" />}>
            <Nav />
          </Suspense>
          <main className="min-w-0 flex-1 px-5 py-6 md:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
