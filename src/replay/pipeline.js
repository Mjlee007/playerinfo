// The "TV picture": post-processing on top of the 3D scene, with quality levels and automatic
// resolution scaling so it stays smooth.
//   performance: plain render, lower resolution
//   high:        bloom, colour grade + vignette, SMAA anti-aliasing
//   ultra:       high + ambient occlusion (GTAO) + depth of field on close-ups
//   auto:        starts at high; scales resolution (and drops/adds effects) to hold ~60 fps
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";

export const QUALITY_LEVELS = [
  ["auto", "Auto (smooth)"],
  ["performance", "Performance"],
  ["high", "High"],
  ["ultra", "Ultra"],
];
const KEY = "playerinfo.highlights.quality.v1";
export function qualityPref() {
  try {
    const v = localStorage.getItem(KEY);
    return QUALITY_LEVELS.some(([k]) => k === v) ? v : "auto";
  } catch {
    return "auto";
  }
}
export function setQualityPref(v) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* private mode */
  }
}

// broadcast colour grade: contrast, saturation, a touch of warmth, vignette, fine film grain
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.08 },
    saturation: { value: 1.12 },
    warmth: { value: 0.03 },
    vignette: { value: 0.32 },
    grain: { value: 0.025 },
    time: { value: 0 },
  },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float contrast, saturation, warmth, vignette, grain, time; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = max(vec3(0.0), (col - 0.18) * contrast + 0.18);
      col *= vec3(1.0 + warmth, 1.0, 1.0 - warmth);
      vec2 d = vUv - 0.5;
      col *= mix(1.0, smoothstep(0.85, 0.2, length(d) * 1.25), vignette);
      col += (hash(vUv * 1000.0) - 0.5) * grain * (0.3 + l);
      gl_FragColor = vec4(col, c.a);
    }`,
};

export function createPipeline(renderer, scene, camera, { quality = "auto", small = false } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let level = quality;
  let effects = quality === "auto" ? "high" : quality; // what's actually running
  let scale = 1; // dynamic resolution
  let width = 1;
  let height = 1;
  let composer = null;
  let passes = {};
  let focus = { on: false, dist: 10 };

  const pixelRatio = () => {
    const base = effects === "performance" ? Math.min(dpr, 1.25) : effects === "ultra" ? dpr : Math.min(dpr, small ? 1.5 : 1.75);
    return Math.max(0.5, base * scale);
  };
  const build = () => {
    composer?.dispose?.();
    composer = null;
    passes = {};
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    if (effects === "performance") return;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: effects === "ultra" ? 0 : 0 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pixelRatio());
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    if (effects === "ultra") {
      passes.ao = new GTAOPass(scene, camera, width, height);
      passes.ao.blendIntensity = 0.85;
      passes.ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1 });
      composer.addPass(passes.ao);
    }
    passes.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.32, 0.55, 0.88);
    composer.addPass(passes.bloom);
    if (effects === "ultra") {
      passes.dof = new BokehPass(scene, camera, { focus: 10, aperture: 0.00012, maxblur: 0.006 });
      passes.dof.enabled = false;
      composer.addPass(passes.dof);
    }
    passes.grade = new ShaderPass(GradeShader);
    composer.addPass(passes.grade);
    composer.addPass(new OutputPass());
    passes.smaa = new SMAAPass(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
    composer.addPass(passes.smaa);
  };

  // frame-time tracking for auto quality
  let avg = 1 / 60;
  let slowFor = 0;
  let fastFor = 0;
  let lastAdjust = 0;
  const adapt = (dt, now) => {
    if (dt <= 0 || dt > 0.5) return;
    avg += (dt - avg) * 0.05;
    if (level !== "auto") return;
    const fps = 1 / avg;
    if (fps < 48) (slowFor += dt), (fastFor = 0);
    else if (fps > 58) (fastFor += dt), (slowFor = 0);
    else (slowFor = 0), (fastFor = 0);
    if (now - lastAdjust < 1.5) return;
    if (slowFor > 1.2) {
      lastAdjust = now;
      slowFor = 0;
      if (scale > 0.62) {
        scale = Math.max(0.6, scale - 0.15);
        build();
      } else if (effects !== "performance") {
        effects = "performance";
        scale = 1;
        build();
      }
    } else if (fastFor > 4) {
      lastAdjust = now;
      fastFor = 0;
      if (scale < 1) {
        scale = Math.min(1, scale + 0.1);
        build();
      } else if (effects === "performance") {
        effects = "high";
        scale = 0.75;
        build();
      }
    }
  };

  let fpsShown = 60;
  return {
    get fps() {
      return fpsShown;
    },
    get info() {
      return { level, effects, scale: Math.round(scale * 100) };
    },
    setSize(w, h) {
      width = Math.max(1, Math.floor(w));
      height = Math.max(1, Math.floor(h));
      build();
    },
    setQuality(q) {
      level = q;
      effects = q === "auto" ? "high" : q;
      scale = 1;
      build();
    },
    // depth of field on close-ups (ultra): focus distance in metres
    setFocus(on, dist) {
      focus = { on, dist };
    },
    render(dt, now) {
      fpsShown += (1 / Math.max(1e-3, avg) - fpsShown) * 0.1;
      adapt(dt, now);
      if (!composer) {
        renderer.render(scene, camera);
        return;
      }
      if (passes.grade) passes.grade.uniforms.time.value = now % 100;
      if (passes.dof) {
        passes.dof.enabled = focus.on;
        passes.dof.uniforms.focus.value = focus.dist;
      }
      composer.render(dt);
    },
    dispose() {
      composer?.dispose?.();
      passes.ao?.dispose?.();
    },
  };
}
