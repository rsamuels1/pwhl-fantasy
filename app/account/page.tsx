import { requireAuth } from "@/lib/auth";
import DisplayNameEditor from "./DisplayNameEditor";
import Link from "next/link";

export const metadata = { title: "Account Settings — PWHL GM" };

export default async function AccountPage() {
  const user = await requireAuth("/account");

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>Account settings</h1>
        <p style={{ margin: "0 0 32px", color: "var(--faint)", fontSize: 13 }}>{user.email}</p>

        <section style={sectionStyle}>
          <h2 style={sectionHeading}>Manager name</h2>
          <p style={sectionHint}>
            This is how you appear to other managers in your leagues.
          </p>
          <DisplayNameEditor initialName={user.displayName} />
        </section>

        <div style={{ borderTop: "1px solid var(--border)", margin: "28px 0" }} />

        <section style={sectionStyle}>
          <h2 style={sectionHeading}>Password</h2>
          <p style={sectionHint}>Change or set your password.</p>
          <Link
            href="/set-password?returnTo=/account"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Change password →
          </Link>
        </section>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
  display: "flex",
  justifyContent: "center",
  padding: "40px 16px 60px",
};

const cardStyle: React.CSSProperties = {
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: "36px 32px",
  maxWidth: 600,
  width: "100%",
  height: "fit-content",
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const sectionHeading: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
};

const sectionHint: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--faint)",
};
