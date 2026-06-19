import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "TikTok Live Chatbox Overlay",
  description: "OBS browser source overlay",
};

export const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={quicksand.variable}>
      <body className={quicksand.className}>{children}</body>
    </html>
  );
}
