// Cricket grounds from every Test-playing country (and a few more), for the 3D highlights.
// Each one sets how the stadium looks: stands (big two-tier bowl, single tier, or an open ground
// with grass banks and trees), roof, seat colours, the home crowd's colours, outfield mowing,
// pitch colour, landmarks behind the stands (a mountain, the sea, a pavilion, a city skyline)
// and the usual light (day, dusk or under floodlights).
//
// The 3D stadiums are themed impressions, not exact models of the real grounds.

// flag: stripes as [colours…], "h" = horizontal, "v" = vertical
const COUNTRIES = {
  IND: { name: "India", flag: ["h", "#ff9933", "#ffffff", "#138808"], crowd: ["#1f5fbf", "#2b7de9", "#ff9933", "#ffffff", "#138808", "#1d4ed8"] },
  AUS: { name: "Australia", flag: ["h", "#00247d", "#00247d", "#00247d"], crowd: ["#ffcd00", "#00843d", "#facc15", "#166534", "#ffffff", "#00247d"] },
  ENG: { name: "England", flag: ["h", "#ffffff", "#ce1124", "#ffffff"], crowd: ["#1e3a8a", "#ffffff", "#ce1124", "#93c5fd", "#e5e7eb", "#0f172a"] },
  PAK: { name: "Pakistan", flag: ["v", "#ffffff", "#01411c", "#01411c"], crowd: ["#01411c", "#15803d", "#22c55e", "#ffffff", "#166534", "#4ade80"] },
  RSA: { name: "South Africa", flag: ["h", "#e03c31", "#007749", "#001489"], crowd: ["#007749", "#ffb612", "#16a34a", "#facc15", "#ffffff", "#001489"] },
  NZ: { name: "New Zealand", flag: ["h", "#00247d", "#00247d", "#00247d"], crowd: ["#111111", "#1f2937", "#ffffff", "#0f172a", "#9ca3af", "#000000"] },
  SL: { name: "Sri Lanka", flag: ["v", "#ffb700", "#8d153a", "#8d153a"], crowd: ["#1e40af", "#ffb700", "#2563eb", "#facc15", "#8d153a", "#ffffff"] },
  BAN: { name: "Bangladesh", flag: ["h", "#006a4e", "#f42a41", "#006a4e"], crowd: ["#006a4e", "#f42a41", "#16a34a", "#dc2626", "#ffffff", "#065f46"] },
  WI: { name: "West Indies", flag: ["h", "#7b0041", "#ffc72c", "#7b0041"], crowd: ["#7b0041", "#ffc72c", "#9d174d", "#facc15", "#ffffff", "#be185d"] },
  AFG: { name: "Afghanistan", flag: ["v", "#000000", "#d32011", "#007a36"], crowd: ["#1d4ed8", "#d32011", "#007a36", "#000000", "#ffffff", "#2563eb"] },
  ZIM: { name: "Zimbabwe", flag: ["h", "#319208", "#ffd200", "#de2010"], crowd: ["#dc2626", "#facc15", "#16a34a", "#000000", "#ffffff", "#ef4444"] },
  IRE: { name: "Ireland", flag: ["v", "#169b62", "#ffffff", "#ff883e"], crowd: ["#169b62", "#22c55e", "#ffffff", "#ff883e", "#15803d", "#0f172a"] },
  UAE: { name: "UAE", flag: ["h", "#00732f", "#ffffff", "#000000"], crowd: ["#ffffff", "#e5e7eb", "#00732f", "#ff0000", "#000000", "#f3f4f6"] },
  NED: { name: "Netherlands", flag: ["h", "#ae1c28", "#ffffff", "#21468b"], crowd: ["#f97316", "#fb923c", "#ffffff", "#21468b", "#ea580c", "#fdba74"] },
};

// Grass: [light stripe, dark stripe]; pitch: [edge, middle]
const GRASS = {
  lush: ["#4f9d41", "#3e8a35"],
  english: ["#5aa64a", "#3f8d38"],
  dry: ["#6c9a3e", "#5a8836"],
  deep: ["#3f8f3a", "#2f7a2f"],
  bright: ["#5fb04a", "#4a9a3c"],
};
const PITCH = {
  dry: ["#b9a46b", "#d2bd84"], // subcontinent: dry and brown
  green: ["#8f9c5c", "#a9b071"], // England / New Zealand: a tinge of grass
  hard: ["#c9b98d", "#e3d6ad"], // Australia / South Africa: hard and pale
  red: ["#b98a5e", "#cfa070"], // Caribbean / Perth
};

// look: stands "bowl" (two tiers + roof) | "tier" (one tier, partial roof) | "open" (grass banks, trees)
const G = (id, name, city, country, look) => ({ id, name, city, countryCode: country, country: COUNTRIES[country].name, flag: COUNTRIES[country].flag, crowd: COUNTRIES[country].crowd, ...look });
export const GROUNDS = [
  // India
  G("eden", "Eden Gardens", "Kolkata", "IND", { stands: "bowl", seats: "#3b5ba5", roof: "#e9eef3", grass: GRASS.lush, pitch: PITCH.dry, light: "night", capacity: "68,000", skyline: true, mowing: "stripes" }),
  G("wankhede", "Wankhede Stadium", "Mumbai", "IND", { stands: "bowl", seats: "#f1f5f9", roof: "#ffffff", grass: GRASS.bright, pitch: PITCH.dry, light: "night", capacity: "33,000", skyline: true, sea: true, mowing: "checks" }),
  G("motera", "Narendra Modi Stadium", "Ahmedabad", "IND", { stands: "bowl", seats: "#1e88e5", roof: "#f3f4f6", grass: GRASS.bright, pitch: PITCH.dry, light: "night", capacity: "132,000", big: true, mowing: "stripes" }),
  G("chinnaswamy", "M. Chinnaswamy Stadium", "Bengaluru", "IND", { stands: "bowl", seats: "#c62828", roof: "#e5e7eb", grass: GRASS.lush, pitch: PITCH.dry, light: "night", capacity: "40,000", skyline: true, mowing: "checks" }),
  G("chepauk", "M. A. Chidambaram Stadium", "Chennai", "IND", { stands: "bowl", seats: "#facc15", roof: "#ffffff", grass: GRASS.dry, pitch: PITCH.dry, light: "day", capacity: "50,000", sea: true, mowing: "stripes" }),
  G("dharamsala", "HPCA Stadium", "Dharamsala", "IND", { stands: "tier", seats: "#d32f2f", roof: "#e5e7eb", grass: GRASS.deep, pitch: PITCH.green, light: "day", capacity: "23,000", mountains: "snow", mowing: "stripes" }),
  // Australia
  G("mcg", "Melbourne Cricket Ground", "Melbourne", "AUS", { stands: "bowl", seats: "#6b7280", roof: "#f8fafc", grass: GRASS.lush, pitch: PITCH.hard, light: "day", capacity: "100,000", big: true, skyline: true, mowing: "circles" }),
  G("scg", "Sydney Cricket Ground", "Sydney", "AUS", { stands: "tier", seats: "#1e3a5f", roof: "#f1f5f9", grass: GRASS.english, pitch: PITCH.hard, light: "day", capacity: "48,000", pavilion: true, mowing: "stripes" }),
  G("adelaide", "Adelaide Oval", "Adelaide", "AUS", { stands: "tier", seats: "#334155", roof: "#ffffff", grass: GRASS.english, pitch: PITCH.hard, light: "dusk", capacity: "53,500", trees: true, mowing: "stripes" }),
  G("perth", "Perth Stadium", "Perth", "AUS", { stands: "bowl", seats: "#f8fafc", roof: "#e2e8f0", grass: GRASS.bright, pitch: PITCH.red, light: "night", capacity: "60,000", mowing: "checks" }),
  G("gabba", "The Gabba", "Brisbane", "AUS", { stands: "bowl", seats: "#7f1d1d", roof: "#e5e7eb", grass: GRASS.lush, pitch: PITCH.hard, light: "day", capacity: "42,000", skyline: true, mowing: "stripes" }),
  // England
  G("lords", "Lord's", "London", "ENG", { stands: "tier", seats: "#f8fafc", roof: "#f1f5f9", grass: GRASS.english, pitch: PITCH.green, light: "day", capacity: "31,100", pavilion: true, mowing: "stripes", slope: true }),
  G("oval", "The Oval", "London", "ENG", { stands: "tier", seats: "#334155", roof: "#e2e8f0", grass: GRASS.english, pitch: PITCH.green, light: "day", capacity: "27,500", gasholder: true, skyline: true, mowing: "stripes" }),
  G("oldtrafford", "Old Trafford", "Manchester", "ENG", { stands: "tier", seats: "#9f1239", roof: "#e5e7eb", grass: GRASS.english, pitch: PITCH.green, light: "dusk", capacity: "26,000", mowing: "checks" }),
  G("edgbaston", "Edgbaston", "Birmingham", "ENG", { stands: "bowl", seats: "#1e3a8a", roof: "#f1f5f9", grass: GRASS.english, pitch: PITCH.green, light: "day", capacity: "25,000", mowing: "stripes" }),
  G("headingley", "Headingley", "Leeds", "ENG", { stands: "tier", seats: "#475569", roof: "#e5e7eb", grass: GRASS.english, pitch: PITCH.green, light: "day", capacity: "18,350", mowing: "stripes" }),
  // Pakistan
  G("gaddafi", "Gaddafi Stadium", "Lahore", "PAK", { stands: "bowl", seats: "#15803d", roof: "#f5f5f4", grass: GRASS.dry, pitch: PITCH.dry, light: "night", capacity: "34,000", mowing: "checks" }),
  G("karachi", "National Stadium", "Karachi", "PAK", { stands: "tier", seats: "#166534", roof: "#e7e5e4", grass: GRASS.dry, pitch: PITCH.dry, light: "dusk", capacity: "34,000", mowing: "stripes" }),
  G("rawalpindi", "Rawalpindi Cricket Stadium", "Rawalpindi", "PAK", { stands: "tier", seats: "#14532d", roof: "#e7e5e4", grass: GRASS.lush, pitch: PITCH.green, light: "day", capacity: "15,000", mountains: "green", mowing: "stripes" }),
  // South Africa
  G("wanderers", "The Wanderers", "Johannesburg", "RSA", { stands: "bowl", seats: "#1d4ed8", roof: "#f1f5f9", grass: GRASS.lush, pitch: PITCH.hard, light: "night", capacity: "28,000", mowing: "stripes" }),
  G("newlands", "Newlands", "Cape Town", "RSA", { stands: "open", seats: "#0f766e", roof: "#f1f5f9", grass: GRASS.english, pitch: PITCH.hard, light: "day", capacity: "25,000", mountains: "table", trees: true, mowing: "stripes" }),
  G("kingsmead", "Kingsmead", "Durban", "RSA", { stands: "tier", seats: "#b45309", roof: "#f1f5f9", grass: GRASS.lush, pitch: PITCH.hard, light: "day", capacity: "25,000", sea: true, mowing: "checks" }),
  // New Zealand
  G("edenpark", "Eden Park", "Auckland", "NZ", { stands: "bowl", seats: "#111827", roof: "#e5e7eb", grass: GRASS.lush, pitch: PITCH.green, light: "night", capacity: "42,000", mowing: "checks" }),
  G("basin", "Basin Reserve", "Wellington", "NZ", { stands: "open", seats: "#e5e7eb", roof: "#f1f5f9", grass: GRASS.english, pitch: PITCH.green, light: "day", capacity: "11,600", trees: true, pavilion: true, mountains: "green", mowing: "stripes" }),
  G("hagley", "Hagley Oval", "Christchurch", "NZ", { stands: "open", seats: "#e5e7eb", roof: "#f1f5f9", grass: GRASS.english, pitch: PITCH.green, light: "day", capacity: "18,000", trees: true, pavilion: true, mowing: "stripes" }),
  // Sri Lanka
  G("premadasa", "R. Premadasa Stadium", "Colombo", "SL", { stands: "bowl", seats: "#1e40af", roof: "#e5e7eb", grass: GRASS.lush, pitch: PITCH.dry, light: "night", capacity: "35,000", mowing: "stripes" }),
  G("galle", "Galle International Stadium", "Galle", "SL", { stands: "open", seats: "#e5e7eb", roof: "#f1f5f9", grass: GRASS.deep, pitch: PITCH.dry, light: "day", capacity: "35,000", sea: true, fort: true, trees: true, mowing: "stripes" }),
  G("kandy", "Pallekele Stadium", "Kandy", "SL", { stands: "open", seats: "#e5e7eb", roof: "#f1f5f9", grass: GRASS.deep, pitch: PITCH.dry, light: "dusk", capacity: "35,000", mountains: "green", trees: true, mowing: "stripes" }),
  // Bangladesh
  G("mirpur", "Shere Bangla National Stadium", "Dhaka", "BAN", { stands: "bowl", seats: "#15803d", roof: "#e5e7eb", grass: GRASS.lush, pitch: PITCH.dry, light: "night", capacity: "25,000", skyline: true, mowing: "checks" }),
  G("chattogram", "Zahur Ahmed Chowdhury Stadium", "Chattogram", "BAN", { stands: "tier", seats: "#dc2626", roof: "#e5e7eb", grass: GRASS.lush, pitch: PITCH.dry, light: "day", capacity: "20,000", mowing: "stripes" }),
  // West Indies
  G("kensington", "Kensington Oval", "Bridgetown, Barbados", "WI", { stands: "tier", seats: "#7c3aed", roof: "#ffffff", grass: GRASS.bright, pitch: PITCH.red, light: "day", capacity: "28,000", sea: true, trees: true, mowing: "stripes" }),
  G("sabina", "Sabina Park", "Kingston, Jamaica", "WI", { stands: "tier", seats: "#0e7490", roof: "#ffffff", grass: GRASS.bright, pitch: PITCH.red, light: "day", capacity: "20,000", mountains: "green", mowing: "stripes" }),
  G("providence", "Providence Stadium", "Georgetown, Guyana", "WI", { stands: "tier", seats: "#be123c", roof: "#ffffff", grass: GRASS.bright, pitch: PITCH.red, light: "night", capacity: "15,000", mowing: "checks" }),
  // UAE (also a home for Afghanistan and Pakistan)
  G("dubai", "Dubai International Stadium", "Dubai", "UAE", { stands: "bowl", seats: "#e5e7eb", roof: "#f8fafc", grass: GRASS.bright, pitch: PITCH.dry, light: "night", capacity: "25,000", skyline: true, desert: true, mowing: "circles" }),
  G("sharjah", "Sharjah Cricket Stadium", "Sharjah", "UAE", { stands: "tier", seats: "#0369a1", roof: "#f8fafc", grass: GRASS.bright, pitch: PITCH.dry, light: "night", capacity: "16,000", desert: true, mowing: "stripes" }),
  G("abudhabi", "Sheikh Zayed Stadium", "Abu Dhabi", "UAE", { stands: "open", seats: "#e5e7eb", roof: "#f8fafc", grass: GRASS.bright, pitch: PITCH.dry, light: "dusk", capacity: "20,000", desert: true, mowing: "checks" }),
  // Afghanistan, Zimbabwe, Ireland, Netherlands
  G("kabul", "Kabul International Cricket Stadium", "Kabul", "AFG", { stands: "tier", seats: "#1d4ed8", roof: "#e5e7eb", grass: GRASS.dry, pitch: PITCH.dry, light: "day", capacity: "6,000", mountains: "brown", mowing: "stripes" }),
  G("harare", "Harare Sports Club", "Harare", "ZIM", { stands: "open", seats: "#e5e7eb", roof: "#f1f5f9", grass: GRASS.lush, pitch: PITCH.red, light: "day", capacity: "10,000", trees: true, pavilion: true, mowing: "stripes" }),
  G("bulawayo", "Queens Sports Club", "Bulawayo", "ZIM", { stands: "open", seats: "#e5e7eb", roof: "#f1f5f9", grass: GRASS.dry, pitch: PITCH.red, light: "day", capacity: "13,000", trees: true, mowing: "stripes" }),
  G("malahide", "Malahide Cricket Club", "Dublin", "IRE", { stands: "open", seats: "#e5e7eb", roof: "#f1f5f9", grass: GRASS.english, pitch: PITCH.green, light: "day", capacity: "11,500", trees: true, castle: true, mowing: "stripes" }),
  G("amstelveen", "VRA Cricket Ground", "Amstelveen", "NED", { stands: "open", seats: "#e5e7eb", roof: "#f1f5f9", grass: GRASS.english, pitch: PITCH.green, light: "day", capacity: "4,500", trees: true, mowing: "stripes" }),
];

export const COUNTRY_LIST = Object.entries(COUNTRIES).map(([code, c]) => ({ code, ...c }));
export const findGround = (id) => GROUNDS.find((g) => g.id === id) || null;
export const DEFAULT_GROUND = "eden";

// A match's venue text → a ground, when it names one ("Eden Gardens", "at the MCG", "Lord's, London").
export function groundForVenue(venue) {
  const v = String(venue || "").toLowerCase();
  if (!v) return null;
  const words = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
  return (
    GROUNDS.find((g) => v.includes(g.name.toLowerCase())) ||
    GROUNDS.find((g) => v.includes(g.id)) ||
    GROUNDS.find((g) => {
      const w = words(g.name).filter((x) => !["stadium", "cricket", "ground", "international", "national", "sports", "club", "oval"].includes(x));
      return w.length && w.every((x) => v.includes(x));
    }) ||
    null
  );
}

// Lighting presets: sky gradient, sun, hemisphere, fog, exposure, floodlights on/off
export const LIGHTS = {
  day: { label: "Day", top: "#2961bd", horizon: "#c7ddf2", sun: "#fff3dc", sunI: 2.6, sunPos: [45, 62, 35], hemi: ["#dbe9ff", "#4a6a3a", 0.85], fog: "#cfdff0", exposure: 1.05, lamps: false, clouds: 0.85, stars: false },
  dusk: { label: "Day / night", top: "#24305e", horizon: "#f2a65a", sun: "#ffc58a", sunI: 1.7, sunPos: [70, 22, -60], hemi: ["#ffd6b0", "#3a4a3a", 0.75], fog: "#d9a27a", exposure: 1.0, lamps: true, clouds: 0.7, stars: false },
  night: { label: "Night (floodlights)", top: "#03060f", horizon: "#16233f", sun: "#f4f7ff", sunI: 2.3, sunPos: [20, 80, 15], hemi: ["#9fb3d9", "#1b2a1b", 0.55], fog: "#0b1222", exposure: 1.12, lamps: true, clouds: 0.12, stars: true },
};
