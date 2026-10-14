import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Noto_Kufi_Arabic,
  Noto_Sans_Arabic,
} from "next/font/google";
import { ToastHost } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { THEME_KEY } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n/client";
import { dirOf } from "@/lib/i18n/config";
import { FALLBACK, MESSAGES } from "@/lib/i18n/messages";
import { getLocale, getT } from "@/lib/i18n/server";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The wordmark and the closing statement are set in Arabic.
const kufi = Noto_Kufi_Arabic({
  variable: "--font-kufi",
  subsets: ["arabic"],
  display: "swap",
});

// Arabic interface text: calmer than Kufi, with weights for UI.
const arabicUi = Noto_Sans_Arabic({
  variable: "--font-arabic-ui",
  subsets: ["arabic"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  const TITLE = t("site.meta.title");
  const DESCRIPTION = t("site.meta.description");
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ),
    title: { default: TITLE, template: "%s · Kun" },
    description: DESCRIPTION,
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      siteName: "Kun",
      type: "website",
      images: [
        { url: "/landing/hero-lighthouse.jpg", width: 1024, height: 576 },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
      images: ["/landing/hero-lighthouse.jpg"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0c" },
    { media: "(prefers-color-scheme: light)", color: "#f2f2ef" },
  ],
};

// Runs before first paint so a saved or system theme never flashes the wrong
// colours. ThemeProvider takes over after hydration.
const THEME_BOOT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});var dark=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var t=dark?"dark":"light";var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t}catch(e){}})()`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirOf(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} ${kufi.variable} ${arabicUi.variable} font-sans antialiased`}
      >
        <I18nProvider
          locale={locale}
          messages={MESSAGES[locale]}
          fallback={FALLBACK}
        >
          <ThemeProvider>
            {children}
            <ToastHost />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
