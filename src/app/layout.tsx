import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelRuggas",
  description: "A pixel-art rugby union game with real teams, competitions and stadiums.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/img/favicon.png" type="image/png" />
      </head>
      <body className="h-full bg-black text-white antialiased">{children}</body>
    </html>
  );
}
