import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Future News",
  description: "A multi-market forecast intelligence terminal."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
