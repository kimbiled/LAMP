import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAMP — система подбора персонала",
  description: "Мультитенантная ATS для рекрутинга",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <head>
        {/* Просим браузер начать качать шрифт сразу, не дожидаясь,
            пока он дойдёт до правил в таблице стилей. Два алфавита,
            которые нужны на каждой странице. */}
        <link
          rel="preload"
          href="/fonts/inter-cyrillic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/inter-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
