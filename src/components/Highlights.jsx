import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

const INTERVAL = 4500;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Rotating "spotlight" of headline facts: one at a time, auto-advancing, with dots,
// prev/next, keyboard arrows and swipe. Pauses on hover/focus; no auto-play for reduced motion.
// items: [{ icon, tag, name, value, unit, note }]
export default function Highlights({ items, label = "Highlights" }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [hover, setHover] = useState(false);
  const touchX = useRef(null);
  const count = items.length;
  const i = count ? index % count : 0;
  const running = playing && !hover && count > 1;

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setIndex((n) => (n + 1) % count), INTERVAL);
    return () => clearTimeout(t);
  }, [running, i, count]);

  if (!count) return null;
  const go = (d) => setIndex((n) => (n + d + count) % count);
  const item = items[i];

  return (
    <section
      className="hl"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="hl-label">
        <span className="live-dot" />
        <span className="hl-label-text">{label}</span>
        <span className="hl-count">
          {i + 1}/{count}
        </span>
      </div>

      <div className="hl-stage" aria-live={running ? "off" : "polite"}>
        <article className="hl-item" key={i} aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
          <span className="hl-icon">{item.icon}</span>
          <span className="hl-text">
            <small>{item.tag}</small>
            <b>{item.name}</b>
            {item.note && <em>{item.note}</em>}
          </span>
          <span className="hl-value">
            {item.value}
            {item.unit && <small>{item.unit}</small>}
          </span>
        </article>
      </div>

      <div className="hl-controls">
        <div className="hl-dots" role="tablist" aria-label="Choose highlight">
          {items.map((it, n) => (
            <button
              key={n}
              role="tab"
              aria-selected={n === i}
              aria-label={it.tag}
              className={n === i ? "on" : ""}
              onClick={() => setIndex(n)}
            />
          ))}
        </div>
        <button className="hl-btn" onClick={() => go(-1)} aria-label="Previous highlight">
          <ChevronLeft size={16} />
        </button>
        <button className="hl-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause highlights" : "Play highlights"}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="hl-btn" onClick={() => go(1)} aria-label="Next highlight">
          <ChevronRight size={16} />
        </button>
      </div>

      <span className="hl-progress" aria-hidden="true">
        <span key={`${i}-${running}`} className={running ? "run" : ""} style={{ "--t": `${INTERVAL}ms` }} />
      </span>
    </section>
  );
}
