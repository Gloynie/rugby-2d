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
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏉</text></svg>"
        />
      </head>
      <body className="h-full bg-black text-white antialiased">{children}</body>
    </html>
  );
}
