# Example: Realistic Three.js Hero Scene (Build mode, R3F)

## Request

> "Add a realistic 3D rose to the hero of our florist's site. It should slowly rotate and react to the mouse. Must work on phones."

## A. Understand

- Existing project: React 19 + Vite + Tailwind. No 3D yet.
- "Realistic" is the hard part: petals are thin, translucent, slightly velvety; realism depends on materials, lighting and silhouette more than polygon count.
- Phones: budget for ~60 fps on mid-range devices or degrade gracefully; must never block the hero text.

## B. Research

- Docs checked: R3F `Canvas` props and React compatibility matrix (R3F major must match React major), drei `Environment`, `ContactShadows`, `useGLTF`, `PerformanceMonitor`; three.js `MeshPhysicalMaterial` (`sheen`, `transmission`, `thickness`).
- Asset options: (1) licensed glTF rose model (check licence: CC0 / CC-BY with attribution / paid), (2) procedural petals in code. Chose (1) if the user supplies or approves a licensed model; otherwise (2) with honest expectations.
- HDRI for reflections: CC0 studio HDRI from Poly Haven, downsized to 1k for mobile.

## C. Design decisions

- Scene: rose on dark neutral background matching the hero section, soft key light from top-left, rim light for petal edges, environment map for subtle reflections, contact shadow under the stem.
- Materials: petals `MeshPhysicalMaterial` with `sheen` (velvet), low `roughness` variance via texture, mild `transmission`/`thickness` only on desktop tier (expensive). Leaves: standard material with normal map.
- Motion: slow idle rotation (`0.15 rad/s`) + pointer tilt (±8°) eased with damping. Under reduced motion: static, best-angle render; no pointer tilt.
- Performance tiers via `PerformanceMonitor`: high = dpr up to 2, transmission on, soft shadows; low = dpr 1, transmission off, baked contact shadow.
- Loading: hero text renders immediately; the canvas is lazy-loaded below it with a poster image of the rose (pre-rendered) as placeholder and WebGL fallback.
- Accessibility: canvas `aria-hidden`; the poster `<img>` carries the alt text; no interaction needed to understand the page.

## D. Implementation highlights

```tsx
// src/components/three/rose-hero.tsx (lazy-loaded)
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";

function Rose({ animate, quality }: { animate: boolean; quality: "high" | "low" }) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/rose.glb"); // Draco/Meshopt-compressed, licence recorded

  useFrame((state, delta) => {
    const g = group.current;
    if (!g || !animate) return;
    g.rotation.y += delta * 0.15;
    // pointer tilt with frame-rate independent damping — no React state per frame
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, state.pointer.y * 0.14, 4, delta);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, -state.pointer.x * 0.14, 4, delta);
  });

  // material tweaks per quality tier, done once when the tier changes
  useEffect(() => {
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshPhysicalMaterial && o.name.startsWith("petal")) {
        o.material.transmission = quality === "high" ? 0.15 : 0;
        o.material.needsUpdate = true;
      }
    });
  }, [scene, quality]);

  return <primitive ref={group} object={scene} position={[0, -0.9, 0]} />;
}

export default function RoseHero({ reducedMotion }: { reducedMotion: boolean }) {
  const [quality, setQuality] = useState<"high" | "low">("high");
  return (
    <Canvas
      aria-hidden="true"
      dpr={quality === "high" ? [1, 2] : 1}
      camera={{ position: [0, 0.4, 3.2], fov: 35 }}
      frameloop={reducedMotion ? "demand" : "always"}
      shadows={quality === "high"}
    >
      <PerformanceMonitor onDecline={() => setQuality("low")} />
      <Suspense fallback={null}>
        <directionalLight position={[-2, 3, 2]} intensity={2.2} castShadow={quality === "high"} />
        <directionalLight position={[2, 1, -3]} intensity={1.2} color="#ffd9e0" />
        <Environment files="/hdri/studio_1k.hdr" />
        <Rose animate={!reducedMotion} quality={quality} />
        <ContactShadows position={[0, -0.9, 0]} opacity={0.45} blur={2.4} far={1.5} resolution={quality === "high" ? 512 : 256} frames={1} />
      </Suspense>
    </Canvas>
  );
}
useGLTF.preload("/models/rose.glb");
```

The hero wraps this in `SceneCanvas` (lazy import + WebGL detection + error boundary + poster fallback) from [references/3d-webgl-graphics.md](../references/3d-webgl-graphics.md).

## E. Verification and honest assessment

- Build + typecheck pass; three.js lands in a separate chunk (checked build output) — main bundle unchanged.
- Browser: desktop Chrome and emulated mobile; real phone check not possible here → stated in report.
- WebGL disabled (Chrome flag / `--disable-gpu` run): poster image shown, no console errors.
- Reduced motion: static render, no rotation or tilt.
- Visual assessment, stated plainly: *petal sheen and rim light read well; petal edges look too uniform and the stem lacks surface detail — not photorealistic yet. Next steps: edge-darkening/vein texture on petals, subtle subsurface colour shift, higher-detail stem normal map.*

Never call it photorealistic because it is 3D. Assess silhouette, material response, lighting, scale cues, shadow grounding and motion separately.
