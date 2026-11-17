// The gel figure's own script. Hands (scripts/gel-player.js) send "gel:hit" / "gel:release" / "gel:set" to her;
// she turns each hit into her own frame and writes it as a row of her material's params (scripts/gel/gel-material.js
// plays it out on the GPU from the world clock). WALK sends her strolling a circle on the stage, her walk clip on her rig,
// her soft tissue bouncing a beat behind each step. Her settings live in state.tune, the HUD reads them there.
import { BUILDS, softSpots } from "./body-lib.js";
const NH = 6, R = 1.25, SPEED = 0.9, CYCLE = 1.15; // her picks: walk circle radius, 0.9 m/s, 1.15 s a stride pair
const clock = (ctx) => (ctx.now() / 1000) % 3600;
const COLORS = { white: "#f1efe9", porcelain: "#f2e2d4", light: "#e7c2a3", tan: "#c99671", bronze: "#9a6844", deep: "#5e3c29", amber: "#d8952e", black: "#1e1e22" };
const lin = (h) => [1, 3, 5].map((i) => Math.pow(parseInt(h.slice(i, i + 2), 16) / 255, 2.2));
const SCRIPT = { standard: "scripts/gel/mannequin.js", tall: "scripts/gel/mannequin-tall.js", petite: "scripts/gel/mannequin-petite.js" };
function walkClip() {
  const K = 13, tr = {};
  const put = (b, k, f) => { (tr[b] ??= {})[k] = Array.from({ length: K }, (_, i) => Math.round(f((i / (K - 1)) * Math.PI * 2) * 10) / 10); };
  for (const [S, o] of [["L", 0], ["R", Math.PI]]) {
    put("thigh" + S, "pitch", (p) => 22 * Math.cos(p + o));
    put("shin" + S, "pitch", (p) => -(4 + 52 * Math.pow(Math.max(0, -Math.sin(p + o)), 1.3) + 8 * Math.pow(Math.max(0, Math.sin(p + o)), 3)));
    put("foot" + S, "pitch", (p) => 12 * Math.cos(p + o) - 4);
    put("upperArm" + S, "pitch", (p) => -15 * Math.cos(p + o));
    put("foreArm" + S, "pitch", (p) => 10 + 9 * (1 - Math.cos(p + o)) / 2);
  }
  put("pelvis", "yaw", (p) => 5 * Math.cos(p)); put("pelvis", "roll", (p) => 2.5 * Math.sin(2 * p));
  put("chest", "yaw", (p) => -7 * Math.cos(p)); put("head", "yaw", (p) => 2 * Math.cos(p));
  return { duration: CYCLE, tracks: tr };
}
const REGIONS = ["chest", "belly", "hips", "thighs"], KEYS = ["soft", "dent", "wob", "settle"];
const WALK = "cdn/clip-walk-female-loop.glb"; // a rigged model body walks on the library's woman's walk
const RUN = "cdn/clip-run-loop.glb", SLOMO = 0.35; // her pick: the run at 35% speed, a slow-motion jog
const GAIT = { walk: { speed: SPEED, gf: 2 / 1.15, ga: 1 }, run: { speed: 3.4 * SLOMO, gf: (2 / 0.72) * SLOMO, ga: 2.4 } }; // m/s round the circle, footfalls a second, bounce size
function tune(ctx) { return { soft: 1, dent: 1, wob: 1, settle: 1, color: "white", gloss: true, build: "standard", ...(ctx.self.state.tune ?? {}) }; }
function apply(ctx) {
  const t = tune(ctx), c = lin(COLORS[t.color] ?? COLORS.white), m = ctx.self.material, sp = ctx.self.state.spots ?? softSpots(BUILDS[t.build] ?? BUILDS.standard); // a sculpted model body carries its own soft spots
  const rg = REGIONS.map((r) => KEYS.map((k) => t.rg?.[r]?.[k] ?? 1)), rsel = REGIONS.indexOf(t.sel) + 1;
  ctx.self.material = { ...m, params: { ...m.params, rg, rsel, soft: t.soft, dent: t.dent, wob: t.wob, settle: t.settle, cr: c[0], cg: c[1], cb: c[2], gloss: t.gloss ? 1 : 0, glow: t.color === "amber" ? 1 : 0, ...sp } };
}
export function onSpawn(ctx) { apply(ctx); }
const yawOf = (ctx) => ctx.self.session.yaw ?? ctx.self.state.yaw ?? 180;
export const ears = {
  "gel:hit": (ctx, a) => {
    const f = ctx.self.feetPosition, th = (yawOf(ctx) * Math.PI) / 180;
    const dx = a.p.x - f.x, dz = a.p.z - f.z;
    const lx = dx * Math.cos(th) - dz * Math.sin(th), lz = dx * Math.sin(th) + dz * Math.cos(th), ly = a.p.y - f.y;
    const m = ctx.self.material, n = ((ctx.self.state.n ?? 0) + 1) % NH;
    const hits = (m.params.hits ?? []).map((r) => [...r]), hk = (m.params.hk ?? []).map((r) => [...r]);
    while (hits.length < NH) hits.push([0, 0, 0, -9999]); while (hk.length < NH) hk.push([0, 0, 0, 0]);
    const kind = { poke: 0, punch: 1, slap: 2, press: 3 }[a.kind] ?? 0;
    hits[n] = [lx, ly, lz, clock(ctx)]; hk[n] = [kind, a.amp ?? 1, kind === 3 ? -1 : 0, 0];
    ctx.self.state.n = n;
    if (kind === 3) ctx.self.state.press = n;
    ctx.self.material = { ...m, params: { ...m.params, hits, hk } };
  },
  "gel:release": (ctx) => {
    const i = ctx.self.state.press; if (i == null) return;
    const m = ctx.self.material, hk = (m.params.hk ?? []).map((r) => [...r]);
    if (hk[i] && hk[i][2] < -0.5) { hk[i][2] = clock(ctx); ctx.self.material = { ...m, params: { ...m.params, hk } }; }
    ctx.self.state.press = null;
  },
  "gel:set": (ctx, a) => {
    const t = tune(ctx);
    const val = Math.round(Math.min(2, Math.max(0, Number(a.v) || 0)) * 100) / 100;
    if (KEYS.includes(a.k)) { if (REGIONS.includes(a.r)) { t.rg = { ...(t.rg ?? {}) }; t.rg[a.r] = { ...(t.rg[a.r] ?? {}), [a.k]: val }; } else t[a.k] = val; }
    if (a.k === "sel") t.sel = REGIONS.includes(a.v) ? a.v : null; // the region the drawer is tuning lights up on her
    if (a.k === "color" && COLORS[a.v]) t.color = a.v;
    if (a.k === "gloss") t.gloss = !t.gloss;
    if (a.k === "build" && SCRIPT[a.v] && a.v !== t.build) { t.build = a.v; ctx.self.primitive = { kind: "scripted", script: SCRIPT[a.v] }; }
    if (a.k === "reset") { if (REGIONS.includes(a.r)) { t.rg = { ...(t.rg ?? {}) }; delete t.rg[a.r]; } else { t.soft = t.dent = t.wob = t.settle = 1; t.rg = {}; } }
    ctx.self.state.tune = t;
    apply(ctx);
  },
  "gel:walk": (ctx, a) => {
    if (ctx.self.state.rigless) return; // a model body without a rig stands for study; walking waits on her rig
    const gait = a?.gait === "run" && ctx.self.state.rigged ? "run" : "walk";
    const on = !(ctx.self.state.walking && ctx.self.state.gait === gait); // the same button stops her; the other switches gait
    ctx.self.state.walking = on; ctx.self.state.gait = on ? gait : null;
    const clip = gait === "run" ? { clip: RUN, loop: "loop", weight: 1, speed: SLOMO } : { clip: ctx.self.state.rigged ? WALK : walkClip(), loop: "loop", weight: 1, speed: 1 };
    ctx.self.anim.walk = on ? clip : null;
    if (!on && ctx.self.state.rigged) { const h = ctx.self.state.home ?? { x: 0, y: 0.05, z: 0 }; ctx.self.feetPosition = h; ctx.self.rotation = { yaw: 180 }; ctx.self.session.yaw = 180; ctx.self.session.r = 0; ctx.self.session.a = null; } // back to her mark, facing you
    const m = ctx.self.material;
    const g = GAIT[gait];
    ctx.self.material = { ...m, params: { ...m.params, walk: on ? 1 : 0, walkT: clock(ctx), gf: g.gf, ga: g.ga } };
  },
  "gel:home": (ctx) => {
    if (ctx.self.state.walking) ears["gel:walk"](ctx);
    const h = ctx.self.state.home ?? { x: 0, y: 0.05, z: 0 };
    ctx.self.feetPosition = h; ctx.self.rotation = { yaw: 180 }; ctx.self.session.yaw = 180; ctx.self.state.yaw = 180;
    ctx.self.session.r = 0;
  },
};
export function update(ctx, dt) {
  const S = ctx.self.session;
  if (!ctx.self.state.walking) { if (S.yaw != null && S.yaw !== ctx.self.state.yaw) ctx.self.state.yaw = Math.round(S.yaw); ctx.sleep(); return; }
  const f = ctx.self.feetPosition;
  S.r = Math.min(R, Math.hypot(f.x, f.z) + 0.45 * dt);
  const g = GAIT[ctx.self.state.gait] ?? GAIT.walk;
  S.a = (S.a ?? Math.atan2(f.x, f.z)) + (g.speed / Math.max(0.4, S.r)) * dt;
  const x = S.r * Math.sin(S.a), z = S.r * Math.cos(S.a), vx = x - f.x, vz = z - f.z;
  if (Math.hypot(vx, vz) > 1e-4) S.yaw = (Math.atan2(-vx, -vz) * 180) / Math.PI;
  const bob = (ctx.self.state.rigged ? 0 : 0.012) * Math.abs(Math.sin((ctx.now() / 1000) * Math.PI * 2 / CYCLE)); // a rigged body's clip carries its own bob
  ctx.self.feetPosition = { x, y: 0.05 + bob, z };
  ctx.self.rotation = { yaw: S.yaw ?? 180 };
}
