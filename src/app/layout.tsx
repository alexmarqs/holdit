import { siteUrl } from "@holdit/utils/env";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { OG_IMAGE } from "./seo";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const TAGLINE = "Nobody holds this wall for long. There's always room for the next square.";
const DESCRIPTION =
  "A wall that forgets. Your area is your spend as a share of everyone else's. New spend takes a slice sized to what they paid \u2014 a smaller cheque does not take the wall. Live spend is half every two weeks if nobody buys, so there is always room next week. No auction, nobody outbid, nobody pushed off. From $1.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "holdit.lol — hold your square of the wall",
    template: "%s · holdit.lol",
  },
  description: DESCRIPTION,
  applicationName: "holdit.lol",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "holdit.lol",
    title: "holdit.lol — hold your square of the wall",
    description: TAGLINE,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "holdit.lol",
    description: TAGLINE,
    images: [OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f8f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1615" },
  ],
};

const THEME_SCRIPT = `
try {
  var stored = localStorage.getItem('holdit-theme');
  var dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static string, runs before paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
