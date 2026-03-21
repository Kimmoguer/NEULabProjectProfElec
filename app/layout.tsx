import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CICS Vault — NEU",
  description: "Official document repository for CICS at New Era University",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
