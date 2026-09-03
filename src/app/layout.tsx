import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "RUGBY 2D",
  description: "A pixel-art rugby union game with real teams, competitions and stadiums.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="h-full bg-black text-white antialiased">{children}</body>
    </html>
  );
}
