import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";
import { LogoWordmark } from "@/components/LogoShield";

export const metadata: Metadata = {
  title: "PWHL GM",
  description: "Run a front office. Draft players, set lineups, and compete for a championship in the Professional Women's Hockey League.",
};

const SVG_FAVICON = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%237c3aed'/><stop offset='1' stop-color='%234c1d95'/></linearGradient></defs><path d='M24 3 L41 9.5 V25 C41 36 24 45 24 45 C24 45 7 36 7 25 V9.5 Z' fill='url(%23g)'/></svg>`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") ?? "";
  const hideNav = pathname === "/beta";

  let user = null;
  if (!hideNav) {
    const { getCurrentUser } = await import("@/lib/auth");
    user = await getCurrentUser().catch(() => null);
  }

  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href={SVG_FAVICON} />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-D8SY67ZKJR"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-D8SY67ZKJR');
          `}
        </Script>
      </head>
      <body className="app-shell">
        {!hideNav && (
          <header className="site-header">
            <div className="site-header-inner">
              <Link href="/" className="site-brand">
                <LogoWordmark />
              </Link>
              <nav className="nav-links">
                <Link href="/" className="nav-link">Home</Link>
                <Link href="/leagues" className="nav-link">Leagues</Link>
                {user && (
                  <>
                    <Link href="/dashboard" className="nav-link">Account</Link>
                    <Link href="/api/auth/logout" className="nav-link">Logout</Link>
                  </>
                )}
                {!user && (
                  <>
                    <Link href="/login" className="nav-link">Sign in</Link>
                    <Link href="/create-league" className="button-primary" style={{ padding: "9px 17px", fontSize: 13 }}>Start your franchise</Link>
                  </>
                )}
              </nav>
            </div>
          </header>
        )}
        <div className="page-width">
          {children}
        </div>
      </body>
    </html>
  );
}
