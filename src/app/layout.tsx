import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { checkSupabaseConnection } from "@/lib/supabase";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cotação IBOV",
  description: "Consulte a cotação atual de ações e FIIs da B3",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dbError = await checkSupabaseConnection();

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-gray-950 text-white">
        {dbError ? (
          <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
            <div className="max-w-lg w-full rounded-2xl bg-gray-900 border border-red-800 px-8 py-10">
              <h1 className="text-2xl font-bold text-red-400 mb-3">
                Erro de Conexão com o Banco de Dados
              </h1>
              <p className="text-gray-400 text-sm leading-relaxed">{dbError}</p>
            </div>
          </div>
        ) : (
          <>
            <Navbar />
            <div className="flex-1 flex flex-col">{children}</div>
          </>
        )}
      </body>
    </html>
  );
}
