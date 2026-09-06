import type { Metadata } from "next";
import { Inter, Playfair_Display, Lora } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import IntroScreen from "@/components/IntroScreen";
import ThemeInitScript from "@/components/ThemeInitScript";
import Toast from "@/components/Toast";
import { SITE } from "@/lib/data";
import { getPublishedArticles } from "@/lib/db/articles";

// La portada consulta si ya existe contenido real publicado (para dejar
// de mostrar el aviso de demo) — no hace falta en cada request exacto,
// con refrescar cada minuto basta.
export const revalidate = 60;

const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
// Serif editorial — Playfair para titulares grandes de sección ("TOP NEWS"),
// Lora para titulares de artículo (más legible en tamaños medianos).
const displayFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display-serif",
  weight: ["700", "800", "900"],
  display: "swap",
});
const headlineFont = Lora({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description:
    "Qué Pasa Vallarta: noticias, Vallarta Ahora, Vallarta Explica, agenda y guía local de Puerto Vallarta. Sitio de demostración (MVP).",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const realArticles = await getPublishedArticles(1);
  const hasRealContent = realArticles.length > 0;

  return (
    <html
      lang="es-MX"
      className={`${bodyFont.variable} ${headlineFont.variable} ${displayFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <IntroScreen />
        <Header hasRealContent={hasRealContent} />
        <main id="main">{children}</main>
        <Footer hasRealContent={hasRealContent} />
        <Toast />
      </body>
    </html>
  );
}
