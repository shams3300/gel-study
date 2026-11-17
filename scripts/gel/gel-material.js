// Ballistic gel skin, mannequin finish. Every hit is a row in params.hits (x, y, z in her own frame, the world clock when
// it landed) and params.hk (kind 0 poke / 1 punch / 2 slap / 3 press, strength, release clock or -1 while held).
// The GPU plays each one out from the clock: a poke jiggles where it lands, a punch dents deep and sends a slow wave
// through her whole body, a slap rings ripples out across the skin, a press sinks, bulges round the finger and swells
// back when let go. While she walks, soft tissue bounces a beat behind each step and settles when she stops.
// Sliders (0..2, 1 = default): soft (cold butter .. jello), dent (depth), wob (how long it shakes), settle (how fast it recovers).
// params.rg: per-region multipliers on those four (chest, belly, hips, thighs); params.rsel: 1..4 lights the region being tuned.
import { MeshPhysicalNodeMaterial } from "builtin/three";
import { vec3, vec4, float, mix, time, positionLocal, normalLocal, attribute, exp, sin, cos, abs, smoothstep, select, step, varying, cameraViewMatrix, positionView, dot, modelWorldMatrix, color } from "builtin/tsl";
const NH = 6;
const DEF_HITS = Array.from({ length: NH }, () => [0, 0, 0, -9999]), DEF_HK = Array.from({ length: NH }, () => [0, 0, 0, 0]);
const DEF_RG = Array.from({ length: 4 }, () => [1, 1, 1, 1]);
export function material(ctx) {
  const m = new MeshPhysicalNodeMaterial();
  const HITS = ctx.param("hits", DEF_HITS), HK = ctx.param("hk", DEF_HK);
  // regions: chest, belly, hips, thighs, each a row of slider multipliers [soft, dent, wob, settle] over the whole-body sliders,
  // blended in by where each vertex rests, so a region's gel fades into its neighbours instead of ending at a seam
  const R = attribute("position", "vec3"), XS = ctx.param("xs", 1), ax = abs(R.x).div(XS);
  const bump = (cx, cy, sx, sy) => exp(ax.sub(cx).div(sx).pow(2).add(R.y.sub(cy).div(sy).pow(2)).negate());
  const RG = ctx.param("rg", DEF_RG);
  const MASK = [
    bump(0.09, ctx.param("by", 1.225), 0.09, 0.1).mul(smoothstep(0.0, -0.07, R.z)),                                     // chest
    exp(R.x.div(0.13).pow(2).add(R.y.sub(ctx.param("ey", 1.02)).div(0.1).pow(2)).negate()).mul(smoothstep(0.0, -0.07, R.z)), // belly
    bump(0.08, ctx.param("gy", 0.885), 0.11, 0.11).mul(smoothstep(-0.02, 0.06, R.z)),                                  // hips and seat
    bump(0.09, ctx.param("ty", 0.68), 0.1, 0.15),                                                                        // thighs
  ];
  const local = (j) => { let f = float(1); for (let r = 0; r < 4; r++) f = f.add(MASK[r].mul(RG.element(r)[["x", "y", "z", "w"][j]].sub(1))); return f.clamp(0, 2.5); };
  const S = ctx.param("soft", 1).clamp(0, 2).mul(local(0)).clamp(0, 2.5), D = ctx.param("dent", 1).clamp(0, 2).mul(local(1)).clamp(0, 2.5);
  const Wb = ctx.param("wob", 1).clamp(0, 2).mul(local(2)).clamp(0, 2.5), St = ctx.param("settle", 1).clamp(0, 2).mul(local(3)).clamp(0, 2.5);
  const DEPTH = S.mul(0.85).add(0.15).mul(D);                 // butter barely gives, jello sinks
  const FREQ = float(Math.PI * 2 * 14).div(S.mul(0.9).add(0.6)); // butter buzzes, jello sways
  const DEC = float(9).div(S.add(0.3)).div(Wb.max(0.05));       // how fast a shake dies
  const SETTLE = float(2).sub(S).mul(1.2).add(0.6).mul(St.max(0.05));
  const VEL = float(2.2).div(S.mul(0.6).add(0.4));              // ripple speed across the skin
  const KW = float(18).div(S.mul(0.5).add(0.5));                // the punch's body wave
  const wrap = (a) => select(a.lessThan(-1800), a.add(3600), a);
  const dispAt = (P) => {
    let d = float(0);
    for (let i = 0; i < NH; i++) {
      const h = HITS.element(i), k = HK.element(i);
      const ageRaw = wrap(time.sub(h.w)), age = ageRaw.max(0), r = P.sub(h.xyz).length(), kind = k.x, rel = k.z; // a hit stamped ahead of this screen's clock waits at 0, never overflows exp into NaN
      const g = (R) => exp(r.div(R).pow(2).negate());
      const fade = (s) => exp(age.mul(DEC).mul(-s));
      const poke = g(0.035).mul(fade(1)).mul(cos(age.mul(FREQ))).mul(-0.016);
      const punch = g(0.085).mul(fade(0.8)).mul(cos(age.mul(FREQ).mul(0.75))).mul(-0.038)
        .add(sin(r.mul(KW).sub(age.mul(FREQ).mul(0.55))).mul(fade(0.45)).mul(exp(r.mul(-1.4))).mul(0.007));
      const front = age.mul(VEL);
      const slap = sin(r.sub(front).mul(55)).mul(smoothstep(front.add(0.03), front.sub(0.05), r)).mul(exp(r.mul(-2.5))).mul(fade(1.1)).mul(0.006)
        .add(g(0.06).mul(fade(1.6)).mul(-0.012));
      const ra = wrap(time.sub(rel)).max(0), held = rel.lessThan(-0.5);
      const hold = float(1).sub(exp(age.mul(-6).div(S.mul(0.5).add(0.5)))).mul(select(held, float(1), exp(ra.mul(SETTLE).negate())));
      const press = g(0.05).sub(exp(r.sub(0.085).div(0.03).pow(2).negate()).mul(0.4)).mul(hold).mul(-0.032);
      const alive = step(0, ageRaw).mul(select(kind.greaterThan(2.5), select(held, float(1), step(ra, 10)), step(age, 14)));
      const v = select(kind.lessThan(0.5), poke, select(kind.lessThan(1.5), punch, select(kind.lessThan(2.5), slap, press)));
      d = d.add(v.mul(k.y).mul(alive));
    }
    return d.mul(DEPTH).clamp(-0.07, 0.03);
  };
  const P = positionLocal, N = normalLocal;
  const d0 = dispAt(P), e = 0.004;
  const grad = vec3(dispAt(P.add(vec3(e, 0, 0))).sub(d0), dispAt(P.add(vec3(0, e, 0))).sub(d0), dispAt(P.add(vec3(0, 0, e))).sub(d0)).div(e);
  const bent = N.sub(grad.sub(N.mul(grad.dot(N)))).normalize();
  // soft tissue: bust, seat, thighs, belly, by where each vertex rests
  const soft = bump(0.084, ctx.param("by", 1.225), 0.075, 0.08).mul(smoothstep(-0.03, -0.1, R.z)).mul(1.4)
    .add(bump(0.072, ctx.param("gy", 0.885), 0.085, 0.085).mul(smoothstep(0.03, 0.09, R.z)))
    .add(bump(0.092, ctx.param("ty", 0.68), 0.085, 0.11).mul(0.55))
    .add(exp(R.x.div(0.11).pow(2).add(R.y.sub(ctx.param("ey", 1.02)).div(0.07).pow(2)).negate()).mul(smoothstep(-0.05, -0.11, R.z)).mul(0.35));
  const walking = ctx.param("walk", 0), since = wrap(time.sub(ctx.param("walkT", -9999))).max(0);
  const amt = select(walking.greaterThan(0.5), float(1), exp(since.mul(DEC).mul(-0.7)));
  const GF = ctx.param("gf", 2 / 1.15), GA = ctx.param("ga", 1); // footfalls a second and bounce size: a slow-mo run swings bigger and slower
  const step2 = time.mul(GF.mul(Math.PI * 2)).sub(S.mul(0.7).add(0.5));
  const lift = vec3(0, sin(step2).mul(amt).mul(soft).mul(S).mul(Wb.mul(0.5).add(0.5)).mul(GA).mul(0.009).sub(soft.mul(S).mul(0.0025)), 0);
  m.positionNode = P.add(N.mul(d0)).add(lift);
  const vn = varying(bent), vd = varying(d0);
  m.normalNode = cameraViewMatrix.mul(modelWorldMatrix.mul(vec4(vn, 0))).xyz.normalize();
  const gloss = ctx.param("gloss", 1).clamp(0, 1);
  const base = vec3(ctx.param("cr", 0.86), ctx.param("cg", 0.84), ctx.param("cb", 0.8));
  m.colorNode = base.mul(vd.mul(4).add(1));
  m.roughnessNode = mix(float(0.62), float(0.3), gloss);
  m.metalness = 0;
  m.clearcoatNode = gloss.mul(0.85);
  m.clearcoatRoughnessNode = float(0.16);
  m.sheenNode = base.mul(float(1).sub(gloss).mul(0.35));
  m.sheenRoughnessNode = float(0.55);
  // amber gel lets light through: a warm inner glow, brightest where the skin turns away and runs thin at the edges
  const glow = ctx.param("glow", 0).clamp(0, 1);
  const facing = dot(m.normalNode, positionView.negate().normalize()).clamp(0, 1), rim = float(1).sub(facing).pow(1.6);
  // the region being tuned in the GEL drawer glows a faint teal on her so you can see what the sliders reach
  const rsel = ctx.param("rsel", 0);
  let selMask = float(0); for (let r = 0; r < 4; r++) selMask = selMask.add(MASK[r].mul(step(float(r + 0.5), rsel).mul(step(rsel, float(r + 1.5)))));
  m.emissiveNode = base.mul(vec3(1, 0.82, 0.55)).mul(rim.mul(0.45).add(0.03)).mul(glow).add(vec3(0.22, 0.84, 0.77).mul(selMask.clamp(0, 1)).mul(0.35));
  // amber gel is see-through: thin where you look straight in, denser at the turning edges; other colours stay solid
  m.transparent = true; m.depthWrite = true;
  m.opacityNode = mix(float(1), rim.mul(0.17).add(0.8), glow.mul(ctx.param("clear", 0).clamp(0, 1)));

  return m;
}
