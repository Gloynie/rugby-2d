import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelRuggas",
  applicationName: "PixelRuggas",
  description: "A pixel-art rugby union game with real teams, competitions and stadiums.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/icon.png", type: "image/png", sizes: "256x256" },
      { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "256x256" },
    ],
  },
  other: {
    "msapplication-TileImage": "/icon-192.png",
    "theme-color": "#070a14",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
        <link rel="icon" type="image/png" sizes="256x256" href="/icon.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="h-full bg-black text-white antialiased">{children}</body>
    </html>
  );
}
