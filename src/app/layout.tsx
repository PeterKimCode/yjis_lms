import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNavigation } from "@/components/app-navigation";
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
  title: "Self-Hosted School LMS",
  description: "Local-first school LMS for self-hosted education workflows",
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
      <body className="min-h-full flex flex-col">
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}
