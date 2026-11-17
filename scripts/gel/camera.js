// Gel studio camera: orbits her. One finger drags the view round her; the HUD's +/- moves in and out.
// It follows her when she walks and frames her above the HUD on a tall phone.
import { rotate } from "builtin/vec3";
export function update(ctx, dt) {
  const fid = ctx.player?.state?.gelFocus; // a figure picked to look at; falls back to the studio figure
  const b = (fid && ctx.place.objects[fid]) || ctx.place.objects["gel-athletic"], f = b?.feetPosition ?? { x: 0, y: 0, z: 0 };
  const S = ctx.self.session, k = Math.min(1, dt * 4);
  S.x = S.x == null ? f.x : S.x + (f.x - S.x) * k; S.z = S.z == null ? f.z : S.z + (f.z - S.z) * k;
  const aspect = ctx.world.camera?.aspect ?? 0.5, tall = aspect < 1;
  const zoom = ctx.player?.state?.gelZoom ?? 1, D = (tall ? 3.0 : 2.6) * zoom;
  const v = ctx.self.view ?? { yaw: 0, pitch: -0.12 };
  const fwd = rotate({ yaw: (v.yaw * 180) / Math.PI, pitch: (v.pitch * 180) / Math.PI }, { x: 0, y: 0, z: -1 });
  const close = Math.max(0, Math.min(1, (1 - zoom) / 0.85)); // 0 at the default distance, 1 fully in
  const ty = (tall ? 0.62 : 0.88) + close * (tall ? 0.55 : 0.32); // a tall phone looks a little low so she stands above the HUD; closing in, the aim rises to her chest
  ctx.self.hideLocalPlayer = true;
  // TRACK: while she walks or runs, the eye runs beside her at chest height, just off her outside shoulder and a touch ahead
  if (ctx.player?.state?.gelTrack && b?.state?.walking) {
    const r = Math.hypot(f.x, f.z) || 1, ox = f.x / r, oz = f.z / r;           // outward from the stage's centre
    const yaw = ((b.rotation?.yaw ?? 0) * Math.PI) / 180, hx = -Math.sin(yaw), hz = -Math.cos(yaw); // her heading
    const side = Math.max(0.5, 1.5 * zoom), CH = 1.15;                          // ＋/－ still pull the track in and out
    const want = { x: f.x + ox * side + hx * 0.35 * side, y: CH + 0.05, z: f.z + oz * side + hz * 0.35 * side };
    const T = S.track ?? (S.track = { ...ctx.self.feetPosition }), q = Math.min(1, dt * 6);
    T.x += (want.x - T.x) * q; T.y += (want.y - T.y) * q; T.z += (want.z - T.z) * q;
    ctx.self.orientation = { source: "script" };
    ctx.self.feetPosition = { x: T.x, y: T.y, z: T.z };
    ctx.self.rotation = { lookAt: { x: f.x, y: CH, z: f.z }, include: ["yaw", "pitch"] };
    return;
  }
  if (S.track) { S.track = null; ctx.self.orientation = undefined; } // back to your own orbit
  ctx.self.feetPosition = { x: S.x - fwd.x * D, y: Math.max(0.15, ty - fwd.y * D), z: S.z - fwd.z * D };
}
