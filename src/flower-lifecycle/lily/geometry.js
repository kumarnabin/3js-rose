import * as THREE from 'three';

// Deformable surfaces whose vertices are rewritten each frame (petals, leaves, stem).

// A (segU x segV) grid. u runs across (uv.x), v along the organ (uv.y).
// Default winding makes the front face the side that faces du x dv.
export function createGrid(segU, segV, { colors = false, flip = false } = {}) {
  const cols = segU + 1, rows = segV + 1, count = cols * rows;
  const geometry = new THREE.BufferGeometry();
  const uv = new Float32Array(count * 2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      uv[k * 2] = i / segU;
      uv[k * 2 + 1] = j / segV;
    }
  }
  const index = [];
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      if (flip) index.push(a, c, b, b, c, d);
      else index.push(a, b, c, b, d, c);
    }
  }
  geometry.setIndex(index);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  geometry.userData = { cols, rows };
  return geometry;
}

// Tube with `segments` rings of `radial` sides; positions and normals are written by writeTube.
export function createTube(segments, radial) {
  const ringSize = radial + 1, rows = segments + 1, count = ringSize * rows;
  const geometry = new THREE.BufferGeometry();
  const uv = new Float32Array(count * 2);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j <= radial; j++) {
      const k = i * ringSize + j;
      uv[k * 2] = j / radial;
      uv[k * 2 + 1] = i / segments;
    }
  }
  const index = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ringSize + j, b = a + 1, c = a + ringSize, d = c + 1;
      index.push(a, c, b, b, c, d); // outward-facing for the N, T, B = N x T frame used by the spine
    }
  }
  geometry.setIndex(index);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.userData = { segments, radial };
  return geometry;
}

// spine: { points, normals, binormals } as flat Float32Arrays, one entry per ring.
export function writeTube(geometry, spine, radiusAt) {
  const { segments, radial } = geometry.userData;
  const pos = geometry.attributes.position.array;
  const nor = geometry.attributes.normal.array;
  const { points: P, normals: N, binormals: B } = spine;
  let k = 0;
  for (let i = 0; i <= segments; i++) {
    const r = radiusAt(i / segments);
    const o = i * 3;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = ca * N[o] + sa * B[o], ny = ca * N[o + 1] + sa * B[o + 1], nz = ca * N[o + 2] + sa * B[o + 2];
      pos[k] = P[o] + nx * r; pos[k + 1] = P[o + 1] + ny * r; pos[k + 2] = P[o + 2] + nz * r;
      nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
      k += 3;
    }
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.normal.needsUpdate = true;
}
