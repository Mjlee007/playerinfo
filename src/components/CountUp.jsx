import { useEffect, useRef, useState } from "react";

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Animates a number from 0 (or its previous value) to `value` with an ease-out curve.
export default function CountUp({ value, decimals = 0, duration = 1100, locale = true }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(reduceMotion() ? target : 0);
  const from = useRef(0);

  useEffect(() => {
    if (reduceMotion()) return setShown(target);
    const start = performance.now();
    const begin = from.current;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(begin + (target - begin) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  const text = locale
    ? shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : shown.toFixed(decimals);
  return <span className="count">{text}</span>;
}
