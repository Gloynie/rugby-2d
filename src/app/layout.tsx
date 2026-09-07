import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelRuggas",
  applicationName: "PixelRuggas",
  description: "A pixel-art rugby union game with real teams, competitions and stadiums.",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    shortcut: ["/favicon.png"],
    apple: [{ url: "/icon.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body className="h-full bg-black text-white antialiased">{children}</body>
    </html>
  );
}
