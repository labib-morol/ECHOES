import type { Metadata, Viewport } from "next";
import { Playfair_Display, Syne } from "next/font/google";
import "./globals.css";
import { checkEnv } from "@/lib/env";

if (typeof window === "undefined") {
  checkEnv();
}

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["italic"],
  variable: "--font-playfair",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-syne",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://echoes-smoky.vercel.app"),
  title: "echoes — throw it into the dark",
  description:
    "an anonymous wall of thoughts. no accounts. no names. they fade in 30 days.",
  openGraph: {
    title: "echoes.",
    description: "throw your thoughts into the dark.",
    type: "website",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "echoes — throw it into the dark",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "echoes.",
    description: "throw your thoughts into the dark.",
    images: ["/og-image.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0b09",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${syne.variable}`}>
      <body>{children}</body>
    </html>
  );
}
