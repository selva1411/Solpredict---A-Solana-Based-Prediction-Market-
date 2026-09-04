import type { Metadata } from "next";
import Script from "next/script";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { Navigation } from "@/components/Navigation";
import { GlobalPriceTicker } from "@/components/GlobalPriceTicker";
import { MobileBottomNav } from "@/components/MobileNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { WebVitals } from "@/components/WebVitals";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { validateEnv } from "@/lib/env-validate";

if (typeof globalThis !== "undefined") {
  try {
    validateEnv();
  } catch {}
}

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
  ),
  title: "SOLPREDICT — Trade the Future on Solana",
  description:
    "The fastest prediction market on Solana. Trade YES/NO positions with CPMM pricing, Pyth oracle resolution and instant on-chain settlement — lower fees, deeper liquidity, faster markets than anywhere else.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SOLPREDICT",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved/system theme before first paint to avoid a bright flash. */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("solpredict-theme");var d=s==="dark"||((!s)&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${archivo.variable} ${jetBrainsMono.variable} min-h-screen text-ink antialiased pt-16 pb-16 md:pb-0`}
      >
        {/* SOLPREDICT — "STUDIO SIGNAL / CMYK BLOCKBOOK". THESIS: a prediction
            market that reads like a modular studio identity system, not a
            dashboard — decisions snap together as saturated CMYK blocks over a
            cool neutral ground, the category and confidence as loud colour,
            the price as type. Refuses the dark-terminal-with-neon-accent
            default. OWN-WORLD: neutral warm-grey ground, ink text, hard
            saturated blocks (cyan/magenta/yellow/grass) as the only force,
            flat vector fills against photographic depth, single Dutch
            grotesque (Archivo) set tight and businesslike. STORY: a bettor
            reads the state of a market at a glance from the colour field and
            the number, then acts. FIRST VIEWPORT: a hard colour bar header
            carrying brand + live index, a neutral ticketed board where each
            market is a row whose YES/NO fill snaps a saturated block, primary
            trade action as a solid magenta/grass bar. FORM: Studio Dumbar
            modular identity; seed key 16571020. FINISH: unreviewed and
            undocumented is unfinished; this build ends with the finish
            review, the verdict, DESIGN.md, and every shipping raster carrying
            its provenance. */}
        <div className="relative z-10">
          <ThemeProvider>
            <WalletContextProvider>
              <ErrorBoundary>
                <Navigation />
                <GlobalPriceTicker />
                <main className="rise">{children}</main>
              </ErrorBoundary>
              <MobileBottomNav />
            </WalletContextProvider>
          </ThemeProvider>
        </div>
        <Toaster />
        <WebVitals />
        <ServiceWorkerRegister />
        <ScrollToTop />
      </body>
    </html>
  );
}
