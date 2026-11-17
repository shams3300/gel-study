// The gel figure's body, shared by three builds (scripts/gel/mannequin*.js): a natural adult female form, full and
// curved, smooth and featureless like a figure-study mannequin. Every surface is a loft through a table of sections,
// Catmull-Rom smoothed so no ring shows; bust and seat are shaped into the torso itself, not stuck on.
// One skin over a 17-bone rig: every vertex carries its own bone weights, blended across each joint.
// A build (B) re-proportions the standard figure: leg, torso and head lengths, width, bust and hip fullness.
export const BUILDS = {
  standard: { leg: 1, torso: 1, head: 1, w: 1, bust: 1, hip: 1 },              // 1.70 m
  tall: { leg: 1.09, torso: 1.05, head: 1.0, w: 0.97, bust: 0.95, hip: 0.98 },  // 1.81 m, long-legged
  petite: { leg: 0.9, torso: 0.93, head: 0.97, w: 0.93, bust: 0.92, hip: 0.96 }, // 1.57 m
};
export function mapY(B, y) {
  if (y < 0.86) return y * B.leg;
  if (y < 1.44) return 0.86 * B.leg + (y - 0.86) * B.torso;
  return 0.86 * B.leg + 0.58 * B.torso + (y - 1.44) * B.head;
}
// where the soft tissue rests in each build, for the gel's gravity sway (scripts/gel/gel-material.js)
export function softSpots(B) {
  return { by: mapY(B, 1.225), gy: mapY(B, 0.885), ty: mapY(B, 0.68), ey: mapY(B, 1.02), xs: B.w };
}
const BONES = {
  pelvis: { pivot: [0, 0.92, 0] }, spine: { parent: "pelvis", pivot: [0, 1.04, 0] }, chest: { parent: "spine", pivot: [0, 1.2, 0] },
  neck: { parent: "chest", pivot: [0, 1.44, 0.01] }, head: { parent: "neck", pivot: [0, 1.52, 0] },
  thighL: { parent: "pelvis", pivot: [0.092, 0.88, 0] }, shinL: { parent: "thighL", pivot: [0.082, 0.48, 0] }, footL: { parent: "shinL", pivot: [0.074, 0.08, 0.01] },
  thighR: { parent: "pelvis", pivot: [-0.092, 0.88, 0] }, shinR: { parent: "thighR", pivot: [-0.082, 0.48, 0] }, footR: { parent: "shinR", pivot: [-0.074, 0.08, 0.01] },
  upperArmL: { parent: "chest", pivot: [0.17, 1.39, 0] }, foreArmL: { parent: "upperArmL", pivot: [0.226, 1.1, 0.01] }, handL: { parent: "foreArmL", pivot: [0.256, 0.85, -0.01] },
  upperArmR: { parent: "chest", pivot: [-0.17, 1.39, 0] }, foreArmR: { parent: "upperArmR", pivot: [-0.226, 1.1, 0.01] }, handR: { parent: "foreArmR", pivot: [-0.256, 0.85, -0.01] },
};
const NAMES = Object.keys(BONES);
export function skeletonFor(B) {
  const out = {};
  for (const [k, b] of Object.entries(BONES)) out[k] = { ...(b.parent ? { parent: b.parent } : {}), pivot: [b.pivot[0] * B.w, mapY(B, b.pivot[1]), b.pivot[2] * B.w] };
  return out;
}
const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
// sample a table of rows (arrays of numbers) along a Catmull-Rom spline, `sub` steps per span
const spline = (rows, steps) => {
  const out = [];
  for (let i = 0; i < rows.length - 1; i++) for (let k = 0; k < steps; k++) {
    const t = k / steps, a = rows[Math.max(0, i - 1)], b = rows[i], c = rows[i + 1], d = rows[Math.min(rows.length - 1, i + 2)];
    out.push(b.map((_, j) => cr(a[j], b[j], c[j], d[j], t)));
  }
  out.push(rows[rows.length - 1]);
  return out;
};
const torsoW = (p) => { const y = p[1], a = ss(0.9, 1.02, y), b = ss(1.08, 1.18, y), c = ss(1.41, 1.47, y); return { pelvis: 1 - a, spine: a * (1 - b), chest: a * b * (1 - c), neck: a * b * c }; };
const legW = (S) => (p) => { const y = p[1], a = ss(0.93, 0.8, y), b = ss(0.53, 0.44, y), c = ss(0.11, 0.07, y); return { pelvis: 1 - a, ["thigh" + S]: a * (1 - b), ["shin" + S]: a * b * (1 - c), ["foot" + S]: a * b * c }; };
const armW = (S) => (p) => { const y = p[1], a = ss(1.43, 1.32, y), b = ss(1.15, 1.05, y), c = ss(0.89, 0.83, y); return { chest: 1 - a, ["upperArm" + S]: a * (1 - b), ["foreArm" + S]: a * b * (1 - c), ["hand" + S]: a * b * c }; };
const neckW = (p) => { const y = p[1], a = ss(1.42, 1.47, y), b = ss(1.5, 1.56, y); return { chest: 1 - a, neck: a * (1 - b), head: a * b }; };
const one = (n) => () => ({ [n]: 1 });

export function buildGeometry(ctx, B) {
  const L1 = ctx.lod <= 1, N = L1 ? 44 : ctx.lod <= 2 ? 28 : 14, SUB = L1 ? 4 : ctx.lod <= 2 ? 2 : 1;
  const J = [], W = [];
  const M = (p) => [p[0] * B.w, mapY(B, p[1]), p[2] * B.w];
  ctx.color("oklch(0.95 0.008 80)");
  ctx.smooth();
  const put = (w) => {
    const e = Object.entries(w).filter(([, v]) => v > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4), s = e.reduce((t, [, v]) => t + v, 0) || 1;
    for (let i = 0; i < 4; i++) { J.push(e[i] ? NAMES.indexOf(e[i][0]) : 0); W.push(e[i] ? e[i][1] / s : 0); }
  };
  const tri = (a, b, c, inside, wf) => {
    const A = M(a), Bb = M(b), C = M(c), I = M(inside);
    let n = crs(sub(Bb, A), sub(C, A)), m = sub([(A[0] + Bb[0] + C[0]) / 3, (A[1] + Bb[1] + C[1]) / 3, (A[2] + Bb[2] + C[2]) / 3], I);
    if (dot(n, m) < 0) { ctx.tri(A[0], A[1], A[2], C[0], C[1], C[2], Bb[0], Bb[1], Bb[2]); put(wf(a)); put(wf(c)); put(wf(b)); }
    else { ctx.tri(A[0], A[1], A[2], Bb[0], Bb[1], Bb[2], C[0], C[1], C[2]); put(wf(a)); put(wf(b)); put(wf(c)); }
  };
  const skin = (rings, centers, wf) => {
    for (let i = 0; i < rings.length - 1; i++) {
      const mid = centers[i].map((v, j) => (v + centers[i + 1][j]) / 2);
      for (let j = 0; j < N; j++) {
        const a = rings[i][j], b = rings[i][(j + 1) % N], c = rings[i + 1][(j + 1) % N], d = rings[i + 1][j];
        tri(a, b, c, mid, wf); tri(a, c, d, mid, wf);
      }
    }
    for (const [i, o] of [[0, 1], [rings.length - 1, rings.length - 2]]) {
      const c = centers[i], inn = c.map((v, j) => v + (centers[o][j] - v) * 0.3);
      for (let j = 0; j < N; j++) tri(c, rings[i][j], rings[i][(j + 1) % N], inn, wf);
    }
  };
  // a vertical loft: rows [y, rx, rz, cz, cx]; bump(p, s, c) reshapes each point (s, c = sin, cos of its angle)
  const loft = (rows, wf, bump) => {
    const S = spline(rows, SUB * 2), rings = [], centers = [];
    for (const [y, rx, rz, cz, cx = 0] of S) {
      const ring = [];
      for (let j = 0; j < N; j++) {
        const a = (j / N) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        let p = [cx + rx * c, y, cz + rz * s];
        if (bump) p = bump(p, s, c);
        ring.push(p);
      }
      rings.push(ring); centers.push([cx, y, cz]);
    }
    skin(rings, centers, wf);
  };
  // a limb: rows [x, y, z, ru, rv] along any direction
  const tube = (rows, wf, ref = [0, 0, 1]) => {
    const S = spline(rows, SUB), rings = [], centers = [];
    S.forEach((r, i) => {
      const p = [r[0], r[1], r[2]], d = nrm(sub(S[Math.min(S.length - 1, i + 1)].slice(0, 3), S[Math.max(0, i - 1)].slice(0, 3)));
      const u = nrm(crs(d, ref)), v = crs(u, d), ring = [];
      for (let j = 0; j < N; j++) {
        const a = (j / N) * Math.PI * 2, c = Math.cos(a) * r[3], s = Math.sin(a) * r[4];
        ring.push([p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s]);
      }
      rings.push(ring); centers.push(p);
    });
    skin(rings, centers, wf);
  };
  const g2 = (x, y) => Math.exp(-(x * x + y * y));
  const H = B.hip, BU = B.bust;
  // torso, crotch to neck base: a full natural figure, waist 28 cm across, hips 38
  loft([
    [0.745, 0.02, 0.02, 0.008], [0.765, 0.085, 0.065, 0.008], [0.8, 0.14 * H, 0.1, 0.01], [0.85, 0.178 * H, 0.122, 0.014], [0.9, 0.19 * H, 0.128, 0.016],
    [0.95, 0.184 * H, 0.124, 0.014], [1.0, 0.163, 0.113, 0.008], [1.05, 0.142, 0.102, 0.002], [1.1, 0.14, 0.104, -0.003], [1.16, 0.148, 0.108, -0.004],
    [1.23, 0.154, 0.11, 0.0], [1.3, 0.16, 0.104, 0.006], [1.355, 0.172, 0.088, 0.012], [1.395, 0.15, 0.074, 0.012], [1.425, 0.1, 0.06, 0.012],
    [1.45, 0.058, 0.052, 0.012], [1.465, 0.02, 0.02, 0.012],
  ], torsoW, (p, s) => {
    let [x, y, z] = p;
    const front = Math.pow(Math.max(0, -s), 0.6), back = Math.pow(Math.max(0, s), 0.6);
    let dz = 0, dx = 0, dy = 0;
    for (const k of [1, -1]) {
      // bust: full and natural, its weight carried low; a soft valley between
      const by = y - 1.226, bx = (x - k * 0.084) / 0.078, bv = by > 0 ? by / 0.1 : by / 0.068, r2 = bx * bx + bv * bv;
      const gb = Math.pow(Math.max(0, 1 - r2), 1.6) * front * BU;
      dz -= 0.092 * gb; dx += k * 0.018 * gb; dy -= 0.02 * gb;
      // seat: round, carried a little low, joining the thigh
      const gy = y - 0.885, gs = g2((x - k * 0.072) / 0.08, gy > 0 ? gy / 0.095 : gy / 0.06) * back * H;
      dz += 0.058 * gs; dx += k * 0.008 * gs; dy -= 0.008 * gs;
    }
    // a soft belly and the hollow of the lower back
    dz -= 0.012 * g2(x / 0.11, (y - 1.0) / 0.07) * front;
    dz -= 0.01 * g2(x / 0.06, (y - 1.06) / 0.06) * back;
    return [x + dx, y + dy, z + dz];
  });
  // neck and head: smooth, abstract, a soft nose
  tube([[0, 1.4, 0.012, 0.054, 0.052], [0, 1.47, 0.008, 0.048, 0.047], [0, 1.53, 0.0, 0.045, 0.045], [0, 1.57, -0.004, 0.04, 0.04]], neckW, [0, 0, 1]);
  loft([
    [1.488, 0.004, 0.004, -0.04], [1.496, 0.022, 0.025, -0.045], [1.51, 0.038, 0.042, -0.04], [1.53, 0.05, 0.056, -0.032], [1.555, 0.06, 0.069, -0.022],
    [1.585, 0.068, 0.082, -0.012], [1.62, 0.073, 0.09, -0.003], [1.65, 0.072, 0.089, 0.003], [1.675, 0.064, 0.08, 0.006], [1.69, 0.05, 0.064, 0.008],
    [1.7, 0.028, 0.038, 0.009], [1.704, 0.004, 0.004, 0.009],
  ], one("head"), (p, s) => [p[0], p[1], p[2] - 0.016 * g2(p[0] / 0.012, (p[1] - 1.583) / 0.02) * Math.max(0, -s)]);
  for (const [k, S] of [[1, "L"], [-1, "R"]]) {
    // legs: a full thigh, the knee, calf swell, slim ankle, then the foot
    tube([[0.07 * k, 0.99, 0, 0.01, 0.01], [0.078 * k, 0.975, 0, 0.055, 0.055], [0.086 * k, 0.94, 0, 0.078, 0.08], [0.09 * k, 0.88, 0, 0.088, 0.092], [0.092 * k, 0.8, 0, 0.094, 0.096],
      [0.089 * k, 0.68, 0.002, 0.078, 0.08], [0.084 * k, 0.56, 0.0, 0.06, 0.062], [0.082 * k, 0.48, -0.002, 0.052, 0.056], [0.08 * k, 0.42, 0.006, 0.055, 0.059],
      [0.078 * k, 0.34, 0.013, 0.057, 0.06], [0.075 * k, 0.24, 0.009, 0.045, 0.047], [0.073 * k, 0.14, 0.008, 0.032, 0.035], [0.073 * k, 0.09, 0.01, 0.03, 0.033], [0.073 * k, 0.075, 0.01, 0.006, 0.006]], legW(S));
    tube([[0.073 * k, 0.05, 0.075, 0.006, 0.006], [0.073 * k, 0.046, 0.06, 0.03, 0.036], [0.073 * k, 0.043, 0.03, 0.035, 0.042], [0.074 * k, 0.036, -0.06, 0.043, 0.031],
      [0.076 * k, 0.026, -0.14, 0.037, 0.022], [0.077 * k, 0.022, -0.175, 0.012, 0.01]], one("foot" + S), [0, 1, 0]);
    // arms: a rounded shoulder cap, upper arm, elbow, forearm, wrist
    tube([[0.15 * k, 1.435, 0, 0.008, 0.008], [0.157 * k, 1.425, 0, 0.036, 0.036], [0.162 * k, 1.4, 0, 0.052, 0.054], [0.18 * k, 1.35, 0.003, 0.052, 0.054], [0.202 * k, 1.25, 0.006, 0.045, 0.047],
      [0.219 * k, 1.13, 0.01, 0.036, 0.037], [0.226 * k, 1.095, 0.01, 0.034, 0.036], [0.237 * k, 1.0, 0.004, 0.037, 0.039], [0.249 * k, 0.9, -0.006, 0.028, 0.031],
      [0.255 * k, 0.85, -0.01, 0.022, 0.028], [0.256 * k, 0.84, -0.01, 0.006, 0.006]], armW(S));
    // a smooth display hand, fingers together
    tube([[0.255 * k, 0.865, -0.01, 0.006, 0.006], [0.256 * k, 0.855, -0.01, 0.02, 0.028], [0.258 * k, 0.8, -0.012, 0.018, 0.041], [0.26 * k, 0.73, -0.012, 0.014, 0.037],
      [0.261 * k, 0.69, -0.01, 0.009, 0.026], [0.261 * k, 0.668, -0.009, 0.003, 0.008]], one("hand" + S));
  }
  return { joints: J, weights: W };
}
export function colliderFor(B) {
  const h = mapY(B, 1.7);
  return [{ kind: "capsule", radius: 0.2 * B.w, halfHeight: h / 2 - 0.2 * B.w, center: [0, h / 2, 0] }];
}
