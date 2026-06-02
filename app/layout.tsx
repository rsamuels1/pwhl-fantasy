import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PWHL Fantasy",
  description: "Fantasy hockey for the Professional Women's Hockey League",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
