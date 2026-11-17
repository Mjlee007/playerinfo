const COLORS = ["#2563eb", "#16a34a", "#db2777", "#ea580c", "#7c3aed", "#0891b2", "#ca8a04", "#dc2626"];

export const initials = (name = "") =>
  name
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

const colorFor = (name = "") =>
  COLORS[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % COLORS.length];

export default function Avatar({ name, size = "md" }) {
  return (
    <span className={`avatar ${size}`} style={{ background: colorFor(name) }}>
      {initials(name)}
    </span>
  );
}
