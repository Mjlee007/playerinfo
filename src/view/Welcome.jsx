import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronRight, Shield } from "lucide-react";
import CountUp from "../components/CountUp.jsx";
import { loadTeamPlayers, squadTotals } from "../context/PlayersContext.jsx";
import { useStart } from "../context/StartContext.jsx";
import { TEAMS } from "../model/teams.js";

function TeamTile({ team, index, count, onPick }) {
  return (
    <button
      className="team-tile"
      style={{ "--accent": team.accent, "--accent-2": team.accent2, "--i": index }}
      onClick={() => onPick(team.id)}
    >
      <span className="team-glow" aria-hidden />
      <span className="team-crest" aria-hidden>
        <Shield size={64} strokeWidth={1.25} />
        <span>{team.code}</span>
      </span>
      <span className="team-name">{team.name}</span>
      <span className="team-count">
        {count} {count === 1 ? "player" : "players"}
      </span>
      <span className="team-enter">
        Enter <ChevronRight size={18} />
      </span>
    </button>
  );
}

export default function Welcome() {
  const { started, start } = useStart();
  const navigate = useNavigate();
  const location = useLocation();
  // "Switch team" in the sidebar jumps straight to the team step.
  const [step, setStep] = useState(location.state?.step === "team" ? "team" : "intro");

  if (started && step !== "team") return <Navigate to="/dashboard" replace />;

  const squads = Object.fromEntries(TEAMS.map((team) => [team.id, loadTeamPlayers(team.id)]));
  const allPlayers = Object.values(squads).flat();
  const t = squadTotals(allPlayers);
  const preview = [
    ["Teams", TEAMS.length],
    ["Players", allPlayers.length],
    ["Runs", t.runs],
  ];

  const pickTeam = (id) => {
    start(id);
    navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
  };

  return (
    <div className="login-page">
      {step === "intro" ? (
        <section className="login-card card welcome-card" key="intro">
          <div className="login-logo">🏏</div>
          <h1>Cricket Squad</h1>
          <p className="muted">Track your players, scores and season stats in one place.</p>

          <div className="welcome-stats">
            {preview.map(([label, value]) => (
              <div key={label}>
                <strong>
                  <CountUp value={value} />
                </strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <button className="btn primary block welcome-cta" onClick={() => setStep("team")} autoFocus>
            Let's start <ArrowRight size={20} />
          </button>
        </section>
      ) : (
        <section className="team-pick" key="team" aria-labelledby="team-pick-title">
          <header className="team-pick-head">
            <span className="team-pick-kicker">Step 2</span>
            <h1 id="team-pick-title">Choose your team</h1>
          </header>

          <div className="team-grid">
            {TEAMS.map((team, i) => (
              <TeamTile key={team.id} team={team} index={i} count={squads[team.id].length} onPick={pickTeam} />
            ))}
          </div>

          <button className="link-back" onClick={() => setStep("intro")}>
            <ArrowLeft size={16} /> Back
          </button>
        </section>
      )}
    </div>
  );
}
