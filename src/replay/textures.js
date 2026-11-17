// Small tiling normal maps generated in the browser (no image files): grass blades, pitch soil and
// fabric weave. They add the fine surface detail that makes the picture read as "real" up close.
import * as THREE from "three";

const cache = new Map();

function heightField(kind, N) {
  const h = new Float32Array(N * N);
  let s = 12345;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const at = (x, y) => ((y + N) % N) * N + ((x + N) % N);
  if (kind === "grass") {
    // many short vertical-ish blades
    for (let i = 0; i < N * 9; i++) {
      const x = Math.floor(r() * N);
      const y = Math.floor(r() * N);
      const len = 3 + Math.floor(r() * 6);
      const lean = (r() - 0.5) * 0.8;
      for (let k = 0; k < len; k++) h[at(Math.round(x + lean * k), y - k)] += 0.6 * (1 - k / len);
    }
  } else if (kind === "soil") {
    for (let i = 0; i < N * N; i++) h[i] = r() * 0.35;
    // cracks
    for (let c = 0; c < 18; c++) {
      let x = r() * N;
      let y = r() * N;
      let a = r() * Math.PI * 2;
      for (let k = 0; k < 40; k++) {
        h[at(Math.round(x), Math.round(y))] -= 1.2;
        a += (r() - 0.5) * 0.9;
        x += Math.cos(a);
        y += Math.sin(a);
      }
    }
  } else {
    // fabric: a fine weave
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = 0.5 * Math.sin((x / N) * Math.PI * 64) * Math.sin((y / N) * Math.PI * 64) + 0.15 * r();
  }
  // soften
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += h[at(x + dx, y + dy)];
      out[y * N + x] = sum / 9;
    }
  return out;
}

function makeNormal(kind) {
  const N = kind === "fabric" ? 128 : 256;
  const h = heightField(kind, N);
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d");
  const img = g.createImageData(N, N);
  const at = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  const k = kind === "soil" ? 2.2 : 3;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k;
      const dy = (at(x, y + 1) - at(x, y - 1)) * k;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      img.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}

// kind: grass | soil | fabric; repeat: number or [x, y]
export function detailNormal(kind, repeat = 1) {
  if (!cache.has(kind)) cache.set(kind, makeNormal(kind));
  const t = new THREE.CanvasTexture(cache.get(kind));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const [rx, ry] = Array.isArray(repeat) ? repeat : [repeat, repeat];
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}
