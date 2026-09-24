import type { Metadata } from "next";
import Script from "next/script";
import { Syne, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { Navigation } from "@/components/Navigation";
import { GlobalPriceTicker } from "@/components/GlobalPriceTicker";
import { Footer } from "@/components/Footer";
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

// Syne — wide, geometric display face for oracular headings
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

// Inter — ultra-clean, high-density typography for modern institutional UI
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// JetBrains Mono — data/numeric display
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
  ),
  title: "SOLPREDICT — Live Prediction Exchange on Solana",
  description:
    "The live prediction exchange on Solana. Trade YES/NO on crypto, sports, politics and more. CPMM pricing, Pyth oracle resolution, instant on-chain settlement.",
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
        <Script
          id="perf-measure-fix"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){if(typeof window!=="undefined"&&window.performance&&window.performance.measure){var orig=window.performance.measure.bind(window.performance);window.performance.measure=function(n,s,e){try{return orig(n,s,e);}catch(_err){return undefined;}};}})();`,
          }}
        />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("solpredict-theme");if(s==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light";}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${syne.variable} ${inter.variable} ${jetBrainsMono.variable} min-h-screen antialiased pt-[48px] pb-16 md:pb-0 bg-[var(--color-ground,#F8F7F4)] text-[var(--color-ink,#181A1C)]`}
      >
        <div className="relative z-10">
          <ThemeProvider>
            <WalletContextProvider>
              <ErrorBoundary>
                <Navigation />
                <GlobalPriceTicker />
                <main>{children}</main>
                <Footer />
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
