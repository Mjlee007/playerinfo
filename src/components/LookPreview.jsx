import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Player } from "../replay/player.js";
import { getDefaultModel, loadModelById } from "../replay/models.js";
import ModelPicker from "./ModelPicker.jsx";

// Camera framings: whole body, the face, the shoes.
const VIEWS = {
  full: { pos: [0, 1.15, 4.4], look: [0, 0.95, 0], fov: 30 },
  face: { pos: [0, 1.68, 1.0], look: [0, 1.66, 0], fov: 30 },
  feet: { pos: [0, 0.45, 1.6], look: [0, 0.12, 0], fov: 32 },
};

// A 3D turntable of a player's look. Drag to turn it; it turns slowly on its own otherwise.
// role: "fielder" (cap) | "batter" (helmet, pads, bat) | "umpire"; view: full | face | feet
export default function LookPreview({ look, kit, name, number, onModel, role = "fielder", view = "full" }) {
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const propsRef = useRef({ look, kit, name, number });
  propsRef.current = { look, kit, name, number };

  useEffect(() => {
    const canvas = canvasRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    scene.add(new THREE.HemisphereLight("#e6efff", "#3d5a35", 1.0));
    const sun = new THREE.DirectionalLight("#fff4e0", 2.4);
    sun.position.set(2, 4, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const rim = new THREE.DirectionalLight("#bcd4ff", 0.9);
    rim.position.set(-3, 2.5, -2);
    scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshStandardMaterial({ color: "#3f8d38", roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const p = new Player({ role, seed: 1 });
    scene.add(p.root);
    playerRef.current = p;
    const { look: l0, kit: k0, name: n0, number: no0 } = propsRef.current;
    p.setKit(role === "umpire" ? { shirt: l0?.umpireShirt || "#f4f4ef", trousers: l0?.umpireTrousers || "#1f2937", trim: "#1f2937" } : { ...k0, name: n0, number: no0 });
    p.setLook(l0);

    // drag to turn
    let yaw = 0;
    let dragging = false;
    let lastX = 0;
    let idleSince = 0;
    const down = (e) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
      idleSince = performance.now();
    };
    const up = () => {
      dragging = false;
      idleSince = performance.now();
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    const fit = () => {
      const w = canvas.clientWidth || 240;
      const h = canvas.clientHeight || 320;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    const cam = { pos: new THREE.Vector3(...VIEWS.full.pos), look: new THREE.Vector3(...VIEWS.full.look) };
    let raf;
    let last = performance.now();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (!dragging && now - idleSince > 3000) yaw += dt * 0.35;
      const s = p.root.scale.y;
      const pose = role === "umpire" ? "umpire" : [["stand", 1], ["ready", 0.15 + 0.08 * Math.sin(now / 700)]];
      p.pose({ x: 0, z: 0, face: yaw, pose, time: now / 1000, bat: role === "batter" ? undefined : null, batTilt: 0.5 });
      const v = VIEWS[viewRef.current] || VIEWS.full;
      const k = 1 - Math.exp(-dt * 6);
      cam.pos.lerp(new THREE.Vector3(v.pos[0], v.pos[1] * (viewRef.current === "feet" ? 1 : s), v.pos[2]), k);
      cam.look.lerp(new THREE.Vector3(v.look[0], v.look[1] * (viewRef.current === "feet" ? 1 : s), v.look[2]), k);
      camera.position.copy(cam.pos);
      camera.lookAt(cam.look);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        [].concat(o.material || []).forEach((m) => {
          m.map?.dispose?.();
          m.dispose?.();
        });
      });
      renderer.dispose();
      playerRef.current = null;
    };
  }, [role]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (role === "umpire") p.setKit({ shirt: look?.umpireShirt || "#f4f4ef", trousers: look?.umpireTrousers || "#1f2937", trim: "#1f2937" });
    else p.setKit({ ...kit, name: look?.shirtName || name, number });
    p.setLook(look);
  }, [look, kit, name, number, role]);

  // the 3D model: this player's own, the default for everyone, or the built-in body
  const modelId = look?.model || "";
  useEffect(() => {
    let alive = true;
    const id = modelId === "builtin" ? "" : modelId || getDefaultModel();
    loadModelById(id).then((tpl) => alive && playerRef.current?.setModel(tpl || null));
    return () => {
      alive = false;
    };
  }, [modelId, role]);

  return (
    <>
      <canvas ref={canvasRef} className="look-preview" title="Drag to turn the player" aria-label="3D preview of the player's look" />
      {onModel && (
        <label className="field look-model">
          3D model
          <ModelPicker mode="player" value={modelId} onChange={onModel} />
        </label>
      )}
    </>
  );
}
