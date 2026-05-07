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
  title: "echoes — throw it into the dark",
  description: "throw your thoughts into the dark.",
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
