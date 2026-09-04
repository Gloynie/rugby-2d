import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelRuggas",
  applicationName: "PixelRuggas",
  description: "A pixel-art rugby union game with real teams, competitions and stadiums.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/brand/pixelruggas-ball.png", type: "image/png", sizes: "256x256" }],
    shortcut: ["/favicon.png"],
    apple: [{ url: "/brand/pixelruggas-ball.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/brand/pixelruggas-ball.png" type="image/png" sizes="256x256" />
        <link rel="apple-touch-icon" href="/brand/pixelruggas-ball.png" />
      </head>
      <body className="h-full bg-black text-white antialiased">{children}</body>
    </html>
  );
}
