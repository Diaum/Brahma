import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { Breadcrumbs } from "@/components/Breadcrumbs";
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
  title: "Brahma — AI Visual Content Pipeline",
  description:
    "Pipeline de criacao de conteudo visual com IA. Crie personagens, escreva roteiros, gere imagens e anime shots para videos curtos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col">
        <header className="relative border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MobileNav />
            <a href="/" className="flex items-center gap-3">
              <span className="text-2xl font-bold text-accent">Brahma</span>
              <span className="text-sm text-muted hidden sm:inline">
                AI Visual Content Pipeline
              </span>
            </a>
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
