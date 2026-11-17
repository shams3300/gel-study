// The new gel figures' sculptor, written from scratch for builds measured off their own reference sheets
// (scripts/gel/fig-athletic.js). The body is ONE continuous surface: every part (torso, neck, head, legs, feet,
// arms) is a measured distance field, the parts melt into each other with a smooth union (no seams where a leg
// meets the hip or an arm the shoulder), and the skin is meshed off that field as a surface net, each vertex
// settled onto the true surface. Every vertex is weighted to a 17-bone rig by which part it belongs to.
const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const at = (rows, y, j) => {
  const n = rows.length;
  if (y <= rows[0][0]) return rows[0][j];
  if (y >= rows[n - 1][0]) return rows[n - 1][j];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m][0] < y) { lo = m; } else { hi = m; } }
  const a = rows[lo], b = rows[hi], t = (y - a[0]) / (b[0] - a[0] || 1);
  return a[j] + (b[j] - a[j]) * t;
};
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const NAMES = ["pelvis", "spine", "chest", "neck", "head", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "upperArmL", "foreArmL", "handL", "upperArmR", "foreArmR", "handR"];

export function makeFigure(FIG) {
  const L = FIG.lm, T = FIG.torso, G = FIG.legs, A = FIG.arms, Hd = FIG.head;
  const tz = (y) => (at(T, y, 2) + at(T, y, 3)) / 2;
  const lz = (y) => (at(G, y, 3) + at(G, y, 4)) / 2;
  const tip = A[A.length - 1][0], sh = A[0][0], wristY = tip + (sh - tip) * 0.24, elbowY = wristY + (sh - wristY) * 0.47;
  const ax = (y) => { for (let i = 1; i < A.length; i++) if (A[i][0] <= y) { const a = A[i - 1], b = A[i], t = (a[0] - y) / (a[0] - b[0] || 1); return a[1] + (b[1] - a[1]) * t; } return A[A.length - 1][1]; };
  const knee = L.crotch * 0.56, ankle = 0.085, hip = L.crotch + 0.07, neckY = L.neck - 0.03;
  const legX = at(G, L.crotch, 1);
  const BONES = {
    pelvis: { pivot: [0, hip + 0.02, tz(hip)] }, spine: { parent: "pelvis", pivot: [0, L.waist - 0.03, tz(L.waist)] },
    chest: { parent: "spine", pivot: [0, L.bustY - 0.06, tz(L.bustY) + 0.02] }, neck: { parent: "chest", pivot: [0, neckY, tz(neckY) + 0.02] },
    head: { parent: "neck", pivot: [0, L.neck + 0.05, tz(neckY) + 0.01] },
  };
  for (const [k, S] of [[1, "L"], [-1, "R"]]) {
    BONES["thigh" + S] = { parent: "pelvis", pivot: [k * legX, hip, lz(hip - 0.08)] };
    BONES["shin" + S] = { parent: "thigh" + S, pivot: [k * at(G, knee, 1), knee, lz(knee)] };
    BONES["foot" + S] = { parent: "shin" + S, pivot: [k * at(G, ankle, 1), ankle, lz(ankle)] };
    BONES["upperArm" + S] = { parent: "chest", pivot: [k * A[0][1], sh, L.armZ] };
    BONES["foreArm" + S] = { parent: "upperArm" + S, pivot: [k * ax(elbowY), elbowY, L.armZ] };
    BONES["hand" + S] = { parent: "foreArm" + S, pivot: [k * ax(wristY), wristY, L.armZ] };
  }
  const W = {
    torso: (y) => { const a = ss(hip - 0.02, L.waist - 0.04, y), b = ss(L.waist, L.bustY - 0.08, y), c = ss(neckY - 0.03, neckY + 0.01, y); return { pelvis: 1 - a, spine: a * (1 - b), chest: a * b * (1 - c), neck: a * b * c }; },
    head: (y) => { const a = ss(neckY - 0.03, neckY + 0.01, y), b = ss(L.neck + 0.02, L.neck + 0.07, y); return { chest: 1 - a, neck: a * (1 - b), head: a * b }; },
    leg: (S, y) => { const a = ss(L.crotch + 0.1, L.crotch - 0.03, y), b = ss(knee + 0.05, knee - 0.04, y), c = ss(ankle + 0.03, ankle - 0.02, y); return { pelvis: 1 - a, ["thigh" + S]: a * (1 - b), ["shin" + S]: a * b * (1 - c), ["foot" + S]: a * b * c }; },
    arm: (S, y) => { const a = ss(sh + 0.03, sh - 0.06, y), b = ss(elbowY + 0.04, elbowY - 0.04, y), c = ss(wristY + 0.02, wristY - 0.02, y); return { chest: 1 - a, ["upperArm" + S]: a * (1 - b), ["foreArm" + S]: a * b * (1 - c), ["hand" + S]: a * b * c }; },
  };
  const spots = { by: L.bustY, gy: L.seatY, ty: L.crotch - 0.14, ey: L.waist - 0.06, xs: at(T, L.bustY, 1) / 0.15 };

  // ---- the parts as distance fields
  // torso half-depth, centre and back/front ratio by height: [y, half depth, centre z, back ratio]
  const DEPTH = [[L.crotch, 0.07, -0.035, 1], [L.seatY - 0.03, 0.09, -0.035, 1], [L.seatY + 0.04, 0.088, -0.035, 1], [L.waist, 0.078, -0.03, 0.95], [L.waist + 0.07, 0.085, -0.028, 0.95],
    [L.bustY - 0.04, 0.095, -0.025, 1], [L.bustY + 0.04, 0.1, -0.02, 1], [L.neck - 0.1, 0.085, -0.012, 1], [L.neck - 0.045, 0.065, -0.012, 1], [L.neck, 0.05, -0.015, 1]];
  const ell = (x, y, z, cx, cy, cz, rx, ry, rz) => { const qx = (x - cx) / rx, qy = (y - cy) / ry, qz = (z - cz) / rz; return (Math.sqrt(qx * qx + qy * qy + qz * qz) - 1) * Math.min(rx, ry, rz); };
  const czAt = (y) => at(DEPTH, y, 2), dAt = (y) => at(DEPTH, y, 1);
  const BU = { y: L.bustY - 0.01, z: czAt(L.bustY) - dAt(L.bustY) + 0.035, x: at(T, L.bustY, 1) * 0.5 };
  const SE = { y: L.seatY + 0.005, z: czAt(L.seatY) + dAt(L.seatY) - 0.03, x: at(T, L.seatY, 1) * 0.44 };
  const HC = { y: L.H - 0.092, z: -0.028 }, NK = [[0, L.neck - 0.12, -0.02], [0, L.H - 0.14, -0.02]];
  const capsule = (x, y, z, a, b, r) => { const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2], l2 = ex * ex + ey * ey + ez * ez, t = Math.min(1, Math.max(0, ((x - a[0]) * ex + (y - a[1]) * ey + (z - a[2]) * ez) / l2)); return Math.hypot(x - a[0] - ex * t, y - a[1] - ey * t, z - a[2] - ez * t) - r; };
  const yT0 = L.seatY, yT1 = L.neck - 0.09;
  const yH0 = L.neck + 0.02, yH1 = Hd[Hd.length - 1][0];
  const yG0 = G[0][0], yG1 = G[G.length - 1][0];
  const nr = Math.min(...Hd.filter((r) => r[0] > L.neck - 0.02 && r[0] < L.neck + 0.04).map((r) => r[1]));
  const ncz = tz(neckY) + 0.006, nR = Math.min(nr, (at(T, neckY, 3) - at(T, neckY, 2)) / 2 * 0.95);
  // an elliptical section: half width rx, front reach rf, back reach rb from its centre
  const sect = (dx, dz, rx, rf, rb) => { const rz = dz < 0 ? rf : rb, q = Math.hypot(dx / rx, dz / rz); return (q - 1) * Math.min(rx, rz); };
  // a vertical part's section at y, rounded into a dome over `cap` metres past either end
  const vpart = (y, y0, y1, cap0, cap1, f) => {
    let yy = y, s = 1;
    if (y > y1) { const e = (y - y1) / cap1; if (e >= 1) return null; s = Math.sqrt(1 - e * e); yy = y1; }
    else if (y < y0) { const e = (y0 - y) / cap0; if (e >= 1) return null; s = Math.sqrt(1 - e * e); yy = y0; }
    return f(yy, s);
  };
  const layer = (y) => {
    const o = {};
    o.t = vpart(y, yT0, yT1, 0.16, 0.07, (yy, s) => { const d = at(DEPTH, yy, 1), cz = at(DEPTH, yy, 2); return { hw: Math.max(0.03, at(T, yy, 1)) * s, cz, rf: d * s, rb: d * s * at(DEPTH, yy, 3), db: 0, ds: 0 }; });
    o.ar = armRange(y);
    if (o.ar) { let lo = 9, hi = -9, rr = 0; for (let i = o.ar[0]; i <= o.ar[1] + 1; i++) { lo = Math.min(lo, armPts[i][0]); hi = Math.max(hi, armPts[i][0]); rr = Math.max(rr, armPts[i][3]); } o.ax = (lo + hi) / 2; o.aw = (hi - lo) / 2 + rr * 1.5 + 0.03; }
    o.g = vpart(y, yG0, yG1, 0.01, 0.13, (yy, s) => { const zf = at(G, yy, 3), zb = at(G, yy, 4), cz = (zf + zb) / 2, rz = Math.min((zb - zf) / 2, at(G, yy, 2) * 1.05); return { xc: at(G, yy, 1), hw: at(G, yy, 2) * s, cz, rz: rz * s }; });
    return o;
  };
  // arm and foot chains: segments of [x, y, z, r] (arm) and the foot's elliptic run
  const armPts = [[A[0][1] - 0.045, sh - 0.015, L.armZ, A[0][2] * 0.8], ...A.filter((r, i) => i % 4 === 0 || i === A.length - 1).map(([y, xc, hw]) => [xc, y, L.armZ + (y < wristY ? -0.004 : 0), hw])];
  const seg = (px, py, pz, a, b, flat) => {
    const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2], l2 = ex * ex + ey * ey + ez * ez || 1;
    const t = Math.min(1, Math.max(0, ((px - a[0]) * ex + (py - a[1]) * ey + (pz - a[2]) * ez) / l2));
    const r = a[3] + (b[3] - a[3]) * t, dz = (pz - (a[2] + ez * t)) / flat;
    return Math.hypot(px - (a[0] + ex * t), py - (a[1] + ey * t), dz) - r;
  };
  // the arm segments within reach of a height, found once per layer
  const armRange = (y) => {
    let i0 = -1, i1 = -1;
    for (let i = 0; i < armPts.length - 1; i++) {
      const a = armPts[i], b = armPts[i + 1];
      if (y <= Math.max(a[1], b[1]) + 0.07 && y >= Math.min(a[1], b[1]) - 0.07) { if (i0 < 0) { i0 = i; } i1 = i; }
    }
    return i0 < 0 ? null : [i0, i1];
  };
  const arm = (o, px, py, pz) => {
    const r = o.ar;
    if (!r) return 9;
    if (Math.abs(px - o.ax) > o.aw || Math.abs(pz - L.armZ) > o.aw) return 9;
    let d = 9;
    for (let i = r[0]; i <= r[1]; i++) { d = Math.min(d, seg(px, py, pz, armPts[i], armPts[i + 1], py < wristY ? 1.45 : 1)); }
    return d;
  };
  const az = lz(ankle), heel = Math.max(L.heel, az + 0.045), toe = L.toe, fxc = at(G, ankle, 1);
  const footRows = [[heel - 0.005, 0.04, 0.026, 0.034], [heel - 0.03, 0.046, 0.031, 0.044], [az - 0.01, 0.05, 0.033, 0.048], [az - 0.06, 0.038, 0.037, 0.034],
    [toe + 0.06, 0.026, 0.04, 0.024], [toe + 0.025, 0.02, 0.036, 0.018], [toe + 0.012, 0.017, 0.03, 0.014]];
  const foot = (px, py, pz) => {
    const dx = Math.abs(px) - fxc;
    if (Math.abs(dx) > 0.08 || py > 0.14 || pz > heel + 0.04 || pz < toe - 0.04) return 9;
    let d = 9;
    for (let i = 0; i < footRows.length - 1; i++) {
      const a = footRows[i], b = footRows[i + 1], t = Math.min(1, Math.max(0, (pz - a[0]) / (b[0] - a[0])));
      const yc = a[1] + (b[1] - a[1]) * t, rw = a[2] + (b[2] - a[2]) * t, rh = a[3] + (b[3] - a[3]) * t, zc = a[0] + (b[0] - a[0]) * t;
      const q = Math.hypot(dx / rw, (py - yc) / rh, (pz - zc) / 0.02 * (t > 0 && t < 1 ? 0 : 1));
      d = Math.min(d, (q - 1) * Math.min(rw, rh));
    }
    return Math.max(d, -py); // a flat sole on the floor
  };
  // every part's distance at a point, given its layer
  const parts = (o, x, y, z) => {
    let dt = 9, dh = 9, dn = 9, dl = 9, dr = 9;
    if (o.t) {
      const t = o.t, ux = Math.abs(x);
      let rf = t.rf, rb = t.rb;
      if (t.db > 0) rf += t.db * Math.exp(-(((ux - 0.42 * t.hw) / (0.3 * t.hw)) ** 2));
      if (t.ds > 0) rb += t.ds * Math.exp(-(((ux - 0.42 * t.hw) / (0.36 * t.hw)) ** 2));
      dt = sect(x, z - t.cz, t.hw, rf, rb);
    }
    if (y > L.neck - 0.17) {
      dn = capsule(x, y, z, NK[0], NK[1], 0.048);
      if (y > L.neck - 0.06) {
        dh = ell(x, y, z, 0, HC.y, HC.z, 0.063, 0.09, 0.083);
        dh = smin(dh, ell(x, y, z, 0, L.H - 0.15, HC.z - 0.018, 0.046, 0.058, 0.064), 0.035);
        dh = smin(dh, ell(x, y, z, 0, L.H - 0.118, HC.z - 0.082, 0.01, 0.022, 0.013), 0.012);
      }
    }
    if (Math.abs(y - BU.y) < 0.12) { const b = ell(Math.abs(x), y, z, BU.x, BU.y, BU.z, 0.066, 0.062, 0.058); dt = smin(dt, b, 0.04); }
    if (Math.abs(y - SE.y) < 0.14) { const b = ell(Math.abs(x), y, z, SE.x, SE.y, SE.z, 0.082, 0.09, 0.07); dt = smin(dt, b, 0.05); }
    if (o.g) { const g = o.g; dl = sect(x - g.xc, z - g.cz, g.hw, g.rz, g.rz); dr = sect(x + g.xc, z - g.cz, g.hw, g.rz, g.rz); }
    const fl = foot(x, y, z), fr = foot(-x, y, z);
    dl = smin(dl, x > 0 ? fl : 9, 0.025); dr = smin(dr, x < 0 ? fr : 9, 0.025);
    const al = x > 0 ? arm(o, x, y, z) : 9, ar = x < 0 ? arm(o, -x, y, z) : 9;
    let al2 = al, ar2 = ar;
    if (Math.abs(y - sh) < 0.1) { const dl0 = ell(Math.abs(x), y, z, A[0][1] - 0.014, sh - 0.05, L.armZ, 0.042, 0.07, 0.046); if (x > 0) { al2 = smin(al, dl0, 0.03); } else { ar2 = smin(ar, dl0, 0.03); } }
    return { dt, dh: smin(dh, dn, 0.04), dl, dr, al: al2, ar: ar2 };
  };
  const field = (o, x, y, z) => {
    const p = parts(o, x, y, z);
    let d = smin(p.dt, Math.min(p.dl, p.dr), 0.06);
    d = smin(d, p.dh, 0.06);
    d = smin(d, Math.min(p.al, p.ar), 0.035);
    return d;
  };

  function geometry(ctx) {
    const h = ctx.lod <= 1 ? 0.0095 : ctx.lod <= 2 ? 0.013 : 0.022, q = 16;
    const X0 = -0.42, Y0 = -0.012, Z0 = -0.24;
    const nx = Math.ceil(0.84 / h) + 1, ny = Math.ceil((L.H + 0.03) / h) + 1, nz = Math.ceil(0.42 / h) + 1;
    // fine layer cache for any height the mesher asks about
    const cache = [];
    for (let c = 0; c <= (ny + 1) * q; c++) { cache.push(layer(Y0 + (c * h) / q)); }
    const lay = (y) => cache[Math.min(cache.length - 1, Math.max(0, Math.round(((y - Y0) / h) * q)))];
    const F = new Float32Array(nx * ny * nz).fill(1), id = (i, j, k) => (j * nz + k) * nx + i;
    // each layer's band: the x columns any part can reach, and its depth range
    const band = [];
    for (let j = 0; j < ny; j++) {
      const o = cache[j * q], y = Y0 + j * h, iv = [];
      let zl = 9, zh = -9;
      const add = (a, b, z0, z1) => { iv.push([a, b]); zl = Math.min(zl, z0); zh = Math.max(zh, z1); };
      if (o.t) { add(-o.t.hw - 0.06, o.t.hw + 0.06, o.t.cz - o.t.rf - 0.1, o.t.cz + o.t.rb + 0.1); }
      if (y > L.neck - 0.17) { add(-0.12, 0.12, -0.18, 0.1); }
      if (o.g) { const g = o.g; add(-g.xc - g.hw - 0.04, g.xc + g.hw + 0.04, g.cz - g.rz - 0.04, g.cz + g.rz + 0.04); }
      if (y < 0.15) { add(-fxc - 0.08, fxc + 0.08, toe - 0.04, heel + 0.04); }
      if (o.ar) { add(o.ax - o.aw, o.ax + o.aw, L.armZ - o.aw, L.armZ + o.aw); add(-o.ax - o.aw, -o.ax + o.aw, L.armZ - o.aw, L.armZ + o.aw); }
      iv.sort((a, b) => a[0] - b[0]);
      const m = [];
      for (const r of iv) { if (m.length && r[0] <= m[m.length - 1][1]) { m[m.length - 1][1] = Math.max(m[m.length - 1][1], r[1]); } else { m.push([r[0], r[1]]); } }
      band.push({ iv: m.map(([a, b]) => [Math.max(0, Math.floor((a - X0) / h)), Math.min(nx - 1, Math.ceil((b - X0) / h))]), k0: Math.max(0, Math.floor((zl - Z0) / h)), k1: Math.min(nz - 1, Math.ceil((zh - Z0) / h)) });
    }
    for (let j = 0; j < ny; j++) {
      const o = cache[j * q], y = Y0 + j * h, b = band[j];
      for (const [i0, i1] of b.iv) { for (let k = b.k0; k <= b.k1; k++) { const z = Z0 + k * h; for (let i = i0; i <= i1; i++) { F[id(i, j, k)] = field(o, X0 + i * h, y, z); } } }
    }
    // surface net: one vertex in each cell the skin crosses, at the mean of its edge crossings
    const V = new Int32Array(nx * ny * nz).fill(-1), P = [];
    const cell = (i, j, k) => {
      const v0 = F[id(i, j, k)], v1 = F[id(i + 1, j, k)], v2 = F[id(i, j + 1, k)], v3 = F[id(i + 1, j + 1, k)], v4 = F[id(i, j, k + 1)], v5 = F[id(i + 1, j, k + 1)], v6 = F[id(i, j + 1, k + 1)], v7 = F[id(i + 1, j + 1, k + 1)];
      const s = (v0 < 0) + (v1 < 0) + (v2 < 0) + (v3 < 0) + (v4 < 0) + (v5 < 0) + (v6 < 0) + (v7 < 0);
      if (s === 0 || s === 8) return;
      let sx = 0, sy = 0, sz = 0, n = 0;
      const ed = (a, b, ax, ay, az, bx, by, bz) => { if ((a < 0) === (b < 0)) return; const t = a / (a - b); sx += ax + (bx - ax) * t; sy += ay + (by - ay) * t; sz += az + (bz - az) * t; n++; };
      ed(v0, v1, 0, 0, 0, 1, 0, 0); ed(v2, v3, 0, 1, 0, 1, 1, 0); ed(v4, v5, 0, 0, 1, 1, 0, 1); ed(v6, v7, 0, 1, 1, 1, 1, 1);
      ed(v0, v2, 0, 0, 0, 0, 1, 0); ed(v1, v3, 1, 0, 0, 1, 1, 0); ed(v4, v6, 0, 0, 1, 0, 1, 1); ed(v5, v7, 1, 0, 1, 1, 1, 1);
      ed(v0, v4, 0, 0, 0, 0, 0, 1); ed(v1, v5, 1, 0, 0, 1, 0, 1); ed(v2, v6, 0, 1, 0, 0, 1, 1); ed(v3, v7, 1, 1, 0, 1, 1, 1);
      V[id(i, j, k)] = P.length;
      P.push([X0 + (i + sx / n) * h, Y0 + (j + sy / n) * h, Z0 + (k + sz / n) * h]);
    };
    const merge = (list) => { const m = []; for (const r of [...list].sort((p, q) => p[0] - q[0])) { if (m.length && r[0] <= m[m.length - 1][1] + 2) { m[m.length - 1][1] = Math.max(m[m.length - 1][1], r[1]); } else { m.push([r[0], r[1]]); } } return m; };
    const span = (j) => { const a = band[Math.max(0, j)], b = band[Math.min(ny - 1, j + 1)]; return { iv: merge([...a.iv, ...b.iv]), k0: Math.max(0, Math.min(a.k0, b.k0) - 1), k1: Math.min(nz - 2, Math.max(a.k1, b.k1)) }; };
    for (let j = 0; j < ny - 1; j++) {
      const sp = span(j);
      for (const [i0, i1] of sp.iv) { for (let k = sp.k0; k <= sp.k1; k++) { for (let i = Math.max(0, i0 - 1); i <= Math.min(nx - 2, i1); i++) { if (V[id(i, j, k)] < 0) { cell(i, j, k); } } } }
    }
    // settle each vertex onto the true surface along the field's gradient
    const e = h * 0.3;
    for (const p of P) {
      const x = p[0], y = p[1], z = p[2], oC = lay(y), oU = lay(y + e), oD = lay(y - e);
      const d = field(oC, x, y, z), gx = (field(oC, x + e, y, z) - field(oC, x - e, y, z)) / (2 * e), gy = (field(oU, x, y + e, z) - field(oD, x, y - e, z)) / (2 * e), gz = (field(oC, x, y, z + e) - field(oC, x, y, z - e)) / (2 * e);
      const gl = Math.hypot(gx, gy, gz) || 1, st = Math.max(-h * 0.5, Math.min(h * 0.5, d / gl)) / gl;
      p[0] = x - gx * st; p[1] = y - gy * st; p[2] = z - gz * st;
    }
    // bone weights: the part a vertex lies closest to, blended near where parts meet, then that part's bones by height
    const PJ = new Int32Array(P.length * 4), PWt = new Float32Array(P.length * 4);
    P.forEach(([x, y, z], vi) => {
      const pr = parts(lay(y), x, y, z), dg = Math.min(pr.dl, pr.dr), da = Math.min(pr.al, pr.ar);
      const m = Math.min(pr.dt, pr.dh, dg, da), w = {};
      const mix = (d, bw) => { const f = Math.exp(-(d - m) / 0.012); if (f < 0.01) return; Object.entries(bw).forEach(([b, v]) => { w[b] = (w[b] ?? 0) + v * f; }); };
      mix(pr.dt, W.torso(y)); mix(pr.dh, W.head(y)); mix(dg, W.leg(pr.dl < pr.dr ? "L" : "R", y)); mix(da, W.arm(pr.al < pr.ar ? "L" : "R", y));
      const e4 = Object.entries(w).filter(([, v]) => v > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4), s = e4.reduce((t, [, v]) => t + v, 0) || 1;
      e4.forEach(([b, v], n) => { PJ[vi * 4 + n] = NAMES.indexOf(b); PWt[vi * 4 + n] = v / s; });
    });
    ctx.color("oklch(0.95 0.008 80)");
    ctx.smooth();
    const J = [], Wt = [];
    const put = (v) => { const o = v * 4; J.push(PJ[o], PJ[o + 1], PJ[o + 2], PJ[o + 3]); Wt.push(PWt[o], PWt[o + 1], PWt[o + 2], PWt[o + 3]); };
    const tri = (a, b, c) => { const A = P[a], B = P[b], Cc = P[c]; ctx.tri(A[0], A[1], A[2], B[0], B[1], B[2], Cc[0], Cc[1], Cc[2]); put(a); put(b); put(c); };
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) { return; } if (flip) { tri(a, c, b); tri(a, d, c); } else { tri(a, b, c); tri(a, c, d); } };
    for (let j = 1; j < ny - 1; j++) {
      const sp = span(j - 1);
      for (const [i0, i1] of sp.iv) { for (let k = Math.max(1, sp.k0); k <= Math.min(nz - 2, sp.k1 + 1); k++) { for (let i = Math.max(1, i0 - 1); i <= Math.min(nx - 2, i1 + 1); i++) {
        const v0 = F[id(i, j, k)] < 0;
        if (v0 !== (F[id(i + 1, j, k)] < 0)) { quad(V[id(i, j - 1, k - 1)], V[id(i, j, k - 1)], V[id(i, j, k)], V[id(i, j - 1, k)], !v0); }
        if (v0 !== (F[id(i, j + 1, k)] < 0)) { quad(V[id(i - 1, j, k - 1)], V[id(i - 1, j, k)], V[id(i, j, k)], V[id(i, j, k - 1)], !v0); }
        if (v0 !== (F[id(i, j, k + 1)] < 0)) { quad(V[id(i - 1, j - 1, k)], V[id(i, j - 1, k)], V[id(i, j, k)], V[id(i - 1, j, k)], !v0); }
      } } }
    }
    return { joints: J, weights: Wt };
  }
  const skeleton = () => BONES;
  const collider = () => [{ kind: "capsule", radius: 0.19, halfHeight: L.H / 2 - 0.19, center: [0, L.H / 2, 0] }];
  return { skeleton, geometry, collider, spots };
}
