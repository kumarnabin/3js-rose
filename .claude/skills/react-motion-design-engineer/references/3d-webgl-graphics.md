# 3D, WebGL, Shaders and Graphics

## Contents

1. Choosing a 3D / graphics stack
2. React Three Fiber setup and version matching
3. SceneCanvas: lazy loading, WebGL detection, fallbacks
4. Realism: colour, light, materials, shadows, scale
5. Animating 3D without React re-renders
6. Assets: glTF pipeline, compression, textures
7. Performance and adaptive quality
8. Resource disposal
9. Accessibility for 3D
10. Vanilla three.js inside React
11. Shaders
12. Realism assessment rubric

---

## 1. Choosing a 3D / graphics stack

| Need | Choose | Notes |
|---|---|---|
| 3D in a React app (default) | three.js + `@react-three/fiber` + `@react-three/drei` | Declarative scene graph, Suspense loading, huge ecosystem |
| Existing vanilla three.js codebase | Keep vanilla three.js | Don't migrate to R3F unless asked; see §10 for React embedding |
| Designer-authored scene, fast iteration | Spline (`@splinetool/react-spline`) | Easy, but heavy runtime and less control over performance; export or self-host the scene file when possible |
| Lightweight WebGL effect (image distortion, gradient, particles) | OGL or a raw shader on a fullscreen quad | Much smaller than three.js |
| Game-like features, physics, editor tooling | Babylon.js | Check React binding maintenance before choosing |
| 2D high-performance canvas (sprites, particles, charts at scale) | PixiJS (`pixi.js`, `@pixi/react`) | 2D only |
| No-code WebGL hero effects | Unicorn Studio embed | Proprietary SaaS; check plan, licence and runtime size |
| Physics in R3F | `@react-three/rapier` | Verify version against R3F |
| Post-processing in R3F | `@react-three/postprocessing` | Use subtly |

## 2. React Three Fiber setup and version matching

R3F majors track React majors: **R3F v9 pairs with React 19, and R3F v8 pairs with React 18.** drei and the other pmndrs packages have matching majors. Check `react` in package.json, then the R3F docs (https://r3f.docs.pmnd.rs/) and each package's peer dependencies, before installing.

Snapshot from 2026-10-28 (re-check before installing): `@react-three/fiber` 9.8 has peers `react >=19 <19.4` and `three >=0.156`. `@react-three/drei` 10.x needs fiber ^9, and `@react-three/postprocessing` 3.x needs fiber >=9.7. A React minor newer than R3F's peer range causes npm peer conflicts. Don't paper over them with `--force` or `--legacy-peer-deps`. Pin React to a supported minor, or wait for an R3F release that supports the newer one.

```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

R3F `<Canvas>` defaults worth knowing: sRGB output colour space and ACES Filmic tone mapping are on by default (`flat` disables tone mapping, `linear` disables sRGB output); `dpr` defaults to `[1, 2]`; the canvas fills its parent, so give the parent an explicit size.

## 3. SceneCanvas: lazy loading, WebGL detection, fallbacks

```tsx
// src/components/three/scene-canvas.tsx
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class CanvasErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D scene failed, showing fallback", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Mounts the lazily imported scene only when near the viewport and WebGL is available. */
export function SceneCanvas({ load, fallback, className }: {
  load: () => Promise<{ default: React.ComponentType }>;
  fallback: ReactNode; // poster image or static illustration with alt text
  className?: string;
}) {
  const [Scene] = useState(() => lazy(load));
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [supported] = useState(hasWebGL);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {!supported || !near ? (
        fallback
      ) : (
        <CanvasErrorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <Scene />
          </Suspense>
        </CanvasErrorBoundary>
      )}
    </div>
  );
}

// usage
// <SceneCanvas className="aspect-square" load={() => import("./rose-hero")} fallback={<img src="/rose-poster.webp" alt="A deep red rose" />} />
```

Also consider: context loss (`gl.domElement.addEventListener("webglcontextlost", …)`) → show fallback; low-power devices (`navigator.hardwareConcurrency`, `PerformanceMonitor`) → static render; reduced motion → `frameloop="demand"` with no ambient animation.

## 4. Realism: colour, light, materials, shadows, scale

Realism comes from light and material response far more than polygon count.

**Colour management**

- Colour textures (base colour, emissive) are sRGB; data textures (normal, roughness, metalness, AO) are linear. glTF loaders set this; for manually loaded textures set `texture.colorSpace = THREE.SRGBColorSpace` on colour maps only.
- Keep tone mapping on (ACES Filmic or AgX) and tune `toneMappingExposure` rather than cranking light intensities.

**Lighting**

- Image-based lighting first: drei `<Environment>` with an HDRI (CC0 sources such as Poly Haven) or `preset`. Use 1k–2k HDRIs on the web.
- Then a key light (directional or spot, casting shadows), optional fill, and a rim/back light to separate silhouettes.
- three.js uses physically based light units; intensities copied from old examples (pre-r155) will look wrong.

**Materials**

- `MeshStandardMaterial` for most surfaces; `MeshPhysicalMaterial` adds `clearcoat` (car paint, lacquer), `sheen` (fabric, velvet, petals), `transmission` + `thickness` + `ior` (glass, liquids, thin translucent parts), `iridescence`. Transmission is expensive — tier it.
- Real surfaces are never uniform: use roughness maps, subtle normal maps, AO. Pure flat colour + uniform roughness reads as plastic.
- Metals: `metalness: 1`, colour from base colour, appearance driven by environment reflections.

**Shadows and grounding**

- Objects must touch something: drei `<ContactShadows>` (cheap, `frames={1}` for static), `<AccumulativeShadows>` (soft, static scenes), or baked AO/shadow textures.
- Real-time shadow maps: tight `shadow.camera` bounds, `shadow.mapSize` 1024–2048, `shadow.bias`/`normalBias` to remove acne.

**Scale and camera**

- 1 unit = 1 metre. Model real objects at real size so lights, shadows and depth of field behave.
- Product shots: narrow FOV (25–40°) to reduce distortion. Avoid default FOV 75 for hero objects.
- Subtle depth of field or vignette only if it serves focus.

**Post-processing** (`@react-three/postprocessing`): SMAA/MSAA for edges, light bloom on genuinely emissive parts only, ambient occlusion (N8AO) for contact depth. Each pass costs GPU — measure.

## 5. Animating 3D without React re-renders

```tsx
useFrame((state, delta) => {
  ref.current.rotation.y += delta * 0.2;                                         // frame-rate independent
  ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, target, 4, delta); // smooth follow
});
```

- Mutate refs inside `useFrame`; never `setState` per frame.
- Use `delta` for frame-rate independence (120 Hz displays exist).
- Pointer: `state.pointer` (normalised −1..1) inside `useFrame`.
- Keyframed or choreographed camera paths: tween object properties with GSAP, or write curve-based sequences in `useFrame`. `@theatre/r3f` only supports R3F v8 and has stalled (see [animation-libraries.md](animation-libraries.md) §8).
- Scroll-linked 3D: drei `ScrollControls` + `useScroll`, or feed Motion's `scrollYProgress.get()` into `useFrame`.
- With `frameloop="demand"`, call `invalidate()` after changes.

## 6. Assets: glTF pipeline, compression, textures

- Format: glTF 2.0 / `.glb`.
- Optimise: `npx @gltf-transform/cli optimize in.glb out.glb` (dedupe, prune, Draco or Meshopt, texture resize/compression — check current CLI flags).
- Generate a typed component: `npx gltfjsx model.glb --transform --types` (verify current flags).
- Textures: size to on-screen use (often 1k–2k); KTX2/Basis for GPU-compressed textures where supported; WebP for simple cases.
- Loading: `useGLTF` (drei) handles Draco/Meshopt decoders; preload with `useGLTF.preload(url)`; show progress with drei `useProgress` only if loading is long.
- Host large files in `public/` or a CDN with caching; never import multi-MB models into the JS bundle.
- Licence every model, HDRI and texture (see [typography-icons-and-assets.md](typography-icons-and-assets.md) checklist).

## 7. Performance and adaptive quality

- Clamp `dpr` (`[1, 2]`, or `[1, 1.5]` on heavy scenes).
- `frameloop="demand"` for static or interaction-only scenes; pause offscreen scenes (unmount, or switch frameloop to `"never"` when out of view).
- Draw calls matter more than triangles: instance repeated meshes (`<Instances>` / `InstancedMesh`), merge static geometry, share materials.
- LOD with drei `<Detailed>`; `<Bvh>` for fast raycasting on complex meshes.
- `<PerformanceMonitor onDecline={…}>` to drop quality tiers (dpr, shadows, transmission, post-processing); `<AdaptiveDpr pixelated />` for automatic dpr changes during movement.
- Measure: `r3f-perf` / `stats-gl` in dev; DevTools Performance with GPU track; test on a mid-range phone when possible and state when you could not.

## 8. Resource disposal

- R3F disposes geometries, materials and textures created declaratively in JSX when they unmount.
- Dispose manually anything created imperatively (`new THREE.BufferGeometry()`, `new THREE.Texture()`, render targets, `EffectComposer`) in effect cleanups.
- Cached loaders (`useGLTF`, `useTexture`) keep assets for reuse; call `useGLTF.clear(url)` if a large model will never return.
- `<primitive object={scene} dispose={null} />` when the object is shared or cached and must survive unmount.
- On full teardown in vanilla three: `renderer.setAnimationLoop(null)`, `renderer.dispose()`, remove listeners and ResizeObserver.

## 9. Accessibility for 3D

- Decorative canvas: `aria-hidden="true"`; meaning carried by surrounding text or a poster `<img alt>`.
- Interactive 3D (configurators, viewers): provide real HTML controls (buttons for colour/angle, sliders) that drive the scene; support keyboard for orbit (arrow keys) or offer preset views.
- Respect reduced motion: no idle rotation, no camera fly-throughs, no auto-orbit.
- Do not hide essential information (prices, specs) inside the canvas.

## 10. Vanilla three.js inside React

```tsx
useEffect(() => {
  const container = ref.current!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const ro = new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(container);
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  return () => {
    renderer.setAnimationLoop(null);
    ro.disconnect();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  };
}, []);
```

StrictMode runs effects twice in development — cleanup must be complete or you get two canvases.

## 11. Shaders

- Learn / prototype: The Book of Shaders (fundamentals), Shadertoy (techniques — check each shader's licence; default is CC BY-NC-SA, which forbids commercial use).
- In R3F: drei `shaderMaterial` helper or `THREE.ShaderMaterial`; update uniforms in `useFrame` via refs.
- Extending built-in materials (keep PBR lighting): `onBeforeCompile` or `three-custom-shader-material` (verify compatibility).
- Keep fragment work cheap on fullscreen passes; avoid loops with high iteration counts on mobile.
- three.js also has TSL / WebGPU renderer paths; only adopt when the project targets them and docs confirm support.

## 12. Realism assessment rubric

Assess and report each line honestly before using words like "realistic":

| Aspect | Question | Typical fix |
|---|---|---|
| Silhouette | Does the shape read correctly at a glance? | Better reference, more edge detail |
| Scale | Do proportions and camera FOV match the real object? | Real-world units, narrower FOV |
| Lighting | Is there IBL + motivated key light? Do highlights make sense? | HDRI, rim light, exposure tuning |
| Materials | Do roughness/normal variations exist? Does it look plastic? | Texture maps, physical material features |
| Grounding | Does it sit on something with contact shadow/AO? | Contact shadows, AO |
| Colour | Is colour management correct (no washed-out or over-saturated textures)? | Colour spaces, tone mapping |
| Motion | Is movement physically plausible (easing, inertia) rather than linear spin? | Damping, springs, subtle timing |
| Edges | Aliasing, shimmering, z-fighting? | AA, dpr, geometry fixes |

Use "stylised", "realistic-leaning" or "photorealistic" accordingly, and list the remaining gaps.
