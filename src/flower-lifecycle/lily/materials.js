import * as THREE from 'three';
import { canvasTexture, drawCapsule, drawLeaf, drawPetal, drawPetalBump, drawStem, PETAL_PALETTES } from '../textures.js';

// Shared materials for the lily. Lifecycle colour shifts (bud green, wilting fade) and backlit
// translucency are injected into the standard physical shader through a few uniforms, so every
// petal keeps using one material and one shader program.

function inject(material, key, uniforms, declarations, chunks) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${declarations}`);
    for (const [anchor, code] of chunks) shader.fragmentShader = shader.fragmentShader.replace(anchor, `${anchor}\n${code}`);
  };
  material.customProgramCacheKey = () => key;
}

const TRANSLUCENCY = /* glsl */ `
  float lilyBack = max(0.0, dot(-normal, uKeyDirView));
  totalEmissiveRadiance += diffuseColor.rgb * uTransColor * uTransStrength * pow(lilyBack, 1.6);
`;

export function createLilyMaterials({ anisotropy = 4 } = {}) {
  const uniforms = {
    uBud: { value: 1 },
    uFade: { value: 0 },
    uKeyDirView: { value: new THREE.Vector3(0, 0, -1) },
    uTransColor: { value: new THREE.Color('#ffb08a') },
    uTransStrength: { value: 0.7 },
  };
  const leafUniforms = {
    uKeyDirView: uniforms.uKeyDirView,
    uTransColor: uniforms.uTransColor,
    uTransStrength: { value: 0.3 },
  };

  const petalMap = canvasTexture(512, 1024, drawPetal, { anisotropy });
  const petalBump = canvasTexture(256, 512, drawPetalBump, { srgb: false, anisotropy });
  const petal = new THREE.MeshPhysicalMaterial({
    map: petalMap,
    bumpMap: petalBump,
    bumpScale: 0.35,
    roughness: 0.5,
    sheen: 0.8,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color('#ffd5e2'),
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  inject(petal, 'lily-petal', uniforms,
    'uniform float uBud;\nuniform float uFade;\nuniform vec3 uKeyDirView;\nuniform vec3 uTransColor;\nuniform float uTransStrength;',
    [
      ['#include <map_fragment>', /* glsl */ `
        #ifdef USE_MAP
          float lilyLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          // bud: green at the base and tip, blushing in between
          float budMask = uBud * (0.55 + 0.45 * (1.0 - smoothstep(0.12, 0.6, vMapUv.y)) + 0.3 * smoothstep(0.75, 1.0, vMapUv.y));
          vec3 budColour = mix(vec3(0.44, 0.6, 0.27), vec3(0.8, 0.52, 0.52), smoothstep(0.3, 0.85, vMapUv.y)) * (0.72 + 0.45 * lilyLum);
          diffuseColor.rgb = mix(diffuseColor.rgb, budColour, clamp(budMask, 0.0, 1.0) * 0.88);
          // wilting: desaturate towards parchment, brown at the margins and tip
          vec3 faded = vec3(lilyLum) * vec3(1.02, 0.86, 0.72);
          diffuseColor.rgb = mix(diffuseColor.rgb, faded, uFade * 0.65);
          float lilyEdge = smoothstep(0.55, 1.0, abs(vMapUv.x * 2.0 - 1.0)) + smoothstep(0.8, 1.0, vMapUv.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.27, 0.17), clamp(lilyEdge, 0.0, 1.0) * uFade * 0.7);
          // the outer (abaxial) face is paler and satin
          if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.9, 0.92) * (0.55 + 0.45 * lilyLum), 0.42 * (1.0 - uBud));
        #endif
      `],
      ['#include <emissivemap_fragment>', TRANSLUCENCY],
    ]);

  const leafMap = canvasTexture(256, 1024, drawLeaf, { anisotropy });
  const leaf = new THREE.MeshPhysicalMaterial({
    map: leafMap,
    roughness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.5,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  inject(leaf, 'lily-leaf', leafUniforms,
    'uniform vec3 uKeyDirView;\nuniform vec3 uTransColor;\nuniform float uTransStrength;',
    [
      ['#include <map_fragment>', 'if (!gl_FrontFacing) diffuseColor.rgb *= vec3(1.12, 1.15, 0.95);'],
      ['#include <emissivemap_fragment>', TRANSLUCENCY],
    ]);

  const stemMap = canvasTexture(64, 256, drawStem, { anisotropy });
  const stem = new THREE.MeshStandardMaterial({ map: stemMap, roughness: 0.48, color: '#ffffff' });

  const capsuleMap = canvasTexture(128, 256, drawCapsule, { anisotropy });
  const capsule = new THREE.MeshPhysicalMaterial({ map: capsuleMap, color: '#7c9a3c', roughness: 0.45, side: THREE.DoubleSide, clearcoat: 0.2 });
  inject(capsule, 'lily-capsule', {}, '', [['#include <map_fragment>', 'if (!gl_FrontFacing) diffuseColor.rgb *= vec3(1.35, 1.28, 1.1);']]);

  return {
    uniforms,
    leafUniforms,
    petal,
    leaf,
    stem,
    capsule,
    filament: new THREE.MeshStandardMaterial({ color: '#e7ecd0', roughness: 0.4 }),
    anther: new THREE.MeshPhysicalMaterial({ color: '#8e3a17', roughness: 0.95, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color('#d9772e') }), // pollen dust
    style: new THREE.MeshStandardMaterial({ color: '#dbe7b9', roughness: 0.35 }),
    stigma: new THREE.MeshPhysicalMaterial({ color: '#b6cf7d', roughness: 0.22, clearcoat: 0.6 }),
    seed: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
    textures: { petalMap, petalBump, leafMap, stemMap, capsuleMap },
    setPalette(name) {
      petalMap.userData.redraw(PETAL_PALETTES[name] ?? PETAL_PALETTES.stargazer);
    },
    dispose() {
      for (const m of [petal, leaf, stem, capsule, this.filament, this.anther, this.style, this.stigma, this.seed]) m.dispose();
      for (const t of Object.values(this.textures)) t.dispose();
    },
  };
}
