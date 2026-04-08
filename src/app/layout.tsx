import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <span className="text-2xl font-bold text-accent">Brahma</span>
            <span className="text-sm text-muted hidden sm:inline">
              AI Visual Content Pipeline
            </span>
          </a>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </body>
    </html>
  );
}
