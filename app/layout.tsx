import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "PWHL Fantasy",
  description: "Fantasy hockey for the Professional Women's Hockey League",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);

  return (
    <html lang="en">
      <body className="app-shell">
        <div className="page-width">
          <header className="top-nav">
            <Link href="/" className="site-brand">
              <span>HF</span>
              PWHL Fantasy
            </Link>
            <nav className="nav-links">
              <Link href="/" className="nav-link">Home</Link>
              <Link href="/leagues" className="nav-link">Leagues</Link>
              {user ? (
                <>
                  <Link href="/dashboard" className="nav-link">{user.displayName}</Link>
                  <Link href="/api/auth/logout" className="nav-link">Logout</Link>
                </>
              ) : (
                <Link href="/login" className="nav-link">Login</Link>
              )}
            </nav>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
