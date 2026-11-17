import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight, CalendarClock, ClipboardList, GitCompareArrows, LayoutDashboard, MoreHorizontal, Radio, Trophy, Users, WifiOff, X,
} from "lucide-react";
import { useOnline } from "../lib/useOnline.js";
import { useStart } from "../context/StartContext.jsx";
import { useFixtures } from "../context/FixturesContext.jsx";
import { TEAMS } from "../model/teams.js";

const GROUPS = [
  {
    label: "Team",
    items: [
      ["/dashboard", "Dashboard", LayoutDashboard],
      ["/players", "Players", Users],
      ["/compare", "Compare", GitCompareArrows],
    ],
  },
  {
    label: "Cricket",
    items: [
      ["/schedule", "Schedule", CalendarClock],
      ["/matches", "Matches", Trophy],
      ["/scorecard", "Career card", ClipboardList],
    ],
  },
];
// Bottom tab bar on phones: four main destinations + More.
const TABS = [
  ["/dashboard", "Home", LayoutDashboard],
  ["/players", "Players", Users],
  ["/schedule", "Schedule", CalendarClock],
  ["/matches", "Matches", Trophy],
];

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="20" height="20">
          <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M9 11c3 2 3 8 0 10M23 11c-3 2-3 8 0 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 2.6" />
        </svg>
      </span>
      <span className="brand-text">
        Player Info
        <small>Cricket club hub</small>
      </span>
    </div>
  );
}

export default function Layout() {
  const { start, team } = useStart();
  const { fixtures } = useFixtures();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const online = useOnline();
  const offlineBadge = !online && (
    <span className="offline-badge" role="status" title="No internet — everything still works and is saved on this device">
      <WifiOff size={14} /> Offline
    </span>
  );
  const live = fixtures.find((f) => f.status === "live");

  useEffect(() => setMore(false), [pathname]);
  useEffect(() => {
    if (!more) return;
    const onKey = (e) => e.key === "Escape" && setMore(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [more]);

  // With two teams, "Switch" jumps straight to the other one; with more, open the team picker.
  const others = TEAMS.filter((t) => t.id !== team?.id);
  const handleSwitch = () => {
    if (others.length === 1) {
      start(others[0].id);
      navigate("/dashboard");
    } else {
      navigate("/welcome", { state: { step: "team" } });
    }
  };

  const teamCard = (
    <div className="team-switch" style={{ "--accent": team?.accent, "--accent-2": team?.accent2 }}>
      <span className="team-chip-code">{team?.code}</span>
      <span className="team-switch-name">
        {team?.name}
        <small>Your team</small>
      </span>
      <button className="icon-btn" onClick={handleSwitch} aria-label={others.length === 1 ? `Switch to ${others[0].name}` : "Switch team"} title={others.length === 1 ? `Switch to ${others[0].name}` : "Switch team"}>
        <ArrowLeftRight size={16} />
      </button>
    </div>
  );

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <Brand />
        {teamCard}
        {live && (
          <NavLink to={`/schedule/${live.id}/live`} className="live-link" title="Live scoring">
            <span className="live-dot" />
            <span className="nav-text">
              Live now <small>{live.title}</small>
            </span>
            <Radio size={16} />
          </NavLink>
        )}
        <nav>
          {GROUPS.map((g) => (
            <div className="nav-group" key={g.label}>
              <div className="nav-label">{g.label}</div>
              {g.items.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} className="nav-link" title={label}>
                  <Icon size={19} />
                  <span className="nav-text">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        {offlineBadge}
        <p className="sidebar-foot">Season 2026 · data stays on this device</p>
      </aside>

      <main className="main">
        <header className="topbar">
          <Brand />
          {offlineBadge}
          {live && (
            <NavLink to={`/schedule/${live.id}/live`} className="topbar-live" aria-label="Live scoring">
              <span className="live-dot" /> Live
            </NavLink>
          )}
          <button className="team-pill" onClick={handleSwitch} style={{ "--accent": team?.accent }} aria-label="Switch team">
            <span className="team-chip-code">{team?.code}</span>
            <ArrowLeftRight size={14} />
          </button>
        </header>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} className="tab-link">
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button className={`tab-link ${more ? "active" : ""}`} onClick={() => setMore((m) => !m)} aria-expanded={more}>
          <MoreHorizontal size={21} />
          <span>More</span>
        </button>
      </nav>

      {more && (
        <div className="more-backdrop" onClick={() => setMore(false)}>
          <div className="more-sheet" role="dialog" aria-label="More" onClick={(e) => e.stopPropagation()}>
            <div className="more-head">
              <b>More</b>
              <button className="icon-btn" onClick={() => setMore(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {teamCard}
            <div className="more-grid">
              {[...GROUPS.flatMap((g) => g.items), ...(live ? [[`/schedule/${live.id}/live`, "Live scoring", Radio]] : [])].map(([to, label, Icon]) => (
                <NavLink key={to} to={to} className="more-link">
                  <Icon size={20} />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
