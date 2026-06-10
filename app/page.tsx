import Link from "next/link";
import QuickDraftJoinForm from "@/components/QuickDraftJoinForm";

export default function Home() {
  return (
    <main>
      <section className="hero-card">
        <div className="hero-copy">
          <p className="hero-eyebrow">PWHL Fantasy</p>
          <h1 className="hero-title">Manage draft nights, rosters, and playoff simulations with a polished fantasy interface.</h1>
          <p className="hero-text">
            Build your league, run live drafts, and replay last season’s real game weeks in an experience inspired by top fantasy sports platforms.
          </p>

          <div className="hero-actions">
            <Link href="/create-league" className="button-primary">Create a league</Link>
            <Link href="/join-league" className="button-secondary">Join a league</Link>
            <Link href="/dashboard" className="button-tertiary">View dashboard</Link>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <strong>Live drafts</strong>
              <span className="panel-text">Open the draft room, share team links, and draft in real time.</span>
            </div>
            <div className="stat-card">
              <strong>Season replay</strong>
              <span className="panel-text">Simulate last year’s schedule as if the season starts tomorrow.</span>
            </div>
            <div className="stat-card">
              <strong>Team analytics</strong>
              <span className="panel-text">See projected roster value, upcoming matchups, and standings at a glance.</span>
            </div>
          </div>
        </div>

        <div className="form-panel">
          <div className="panel-headline">Quick draft access</div>
          <p className="panel-text">Have a league and team ID? Jump directly into the draft room to start picking.</p>
          <QuickDraftJoinForm />
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-headline">One league, one streamlined flow</div>
          <p className="panel-text">Perfect for beta testers: create a league, add teams, and test the full draft-to-playoff experience.</p>
        </div>
        <div className="panel">
          <div className="panel-headline">Fantasy-first navigation</div>
          <p className="panel-text">Jump between dashboard, draft room, team pages, and playoff brackets with a familiar fantasy layout.</p>
        </div>
      </section>
    </main>
  );
}
