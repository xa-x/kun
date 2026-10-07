import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Kufi_Arabic } from "next/font/google";
import { ToastHost } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { THEME_KEY } from "@/lib/theme";
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

const TITLE = "كُن · Kun: the AI canvas that keeps running";
const DESCRIPTION =
  "Wire text, image, audio and video models together on one canvas, then schedule, share and call the result from anywhere.";

export const metadata: Metadata = {
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
    images: [{ url: "/landing/hero-lighthouse.jpg", width: 1024, height: 576 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/landing/hero-lighthouse.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0c" },
    { media: "(prefers-color-scheme: light)", color: "#f2f2ef" },
  ],
};

// Runs before first paint so a saved or system theme never flashes the wrong
// colours. ThemeProvider takes over after hydration.
const THEME_BOOT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});var dark=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var t=dark?"dark":"light";var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} ${kufi.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          {children}
          <ToastHost />
        </ThemeProvider>
      </body>
    </html>
  );
}
