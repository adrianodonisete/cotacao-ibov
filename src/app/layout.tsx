import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Footer } from "@/components/ui/Footer";
import { checkSupabaseConnection } from "@/lib/supabase";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
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
      className={`${cormorant.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-screen flex flex-col">
        {dbError ? (
          <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
            <div className="max-w-lg w-full rounded-lg bg-surface-card border border-error px-8 py-10">
              <h1 className="font-display text-title-lg text-error mb-3">
                Erro de Conexão com o Banco de Dados
              </h1>
              <p className="text-body text-body text-body-sm leading-relaxed">{dbError}</p>
            </div>
          </div>
        ) : (
          <>
            <Navbar />
            <div className="flex-1 flex flex-col">{children}</div>
            <Footer />
          </>
        )}
      </body>
    </html>
  );
}
