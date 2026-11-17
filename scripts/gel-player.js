// The player's hands in the gel studio (place "gel"): a tap on her lands the chosen hit (poke, punch or slap),
// a held finger presses into her and lets go on lift; the HUD's buttons arrive as sendAction("gel", { op, … }).
import { raycast, getInputRay } from "builtin/physics";
const MAIN = "gel-athletic", ATHLETIC = "gel-athletic"; // the athletic figure is the studio's one body
let BODY = MAIN; // the figure your hands and the HUD work on: player.state.gelFocus, else the stand-by mannequin
const SND = {
  poke: "cdn/sfx-soft-gel-poke-squish.mp3",
  punch: "cdn/sfx-deep-ballistic-gel-punch-thud-wobble.mp3",
  slap: "cdn/sfx-wet-gel-slap-smack.mp3",
  press: "cdn/sfx-slow-squeezing-gel-press-creak.mp3",
  tap: "cdn/sfx-crisp-sci-fi-ui-button-tap-blip.mp3",
};
const onHer = (hit) => hit && (hit.id === BODY || String(hit.id).startsWith(BODY + "/"));
export function onInput(ctx, input) {
  if (ctx.self.place !== "gel") return;
  const me = ctx.self.state;
  BODY = me.gelFocus && ctx.place.objects[me.gelFocus] ? me.gelFocus : MAIN;
  if (input.pressed.gel) {
    const a = input.actionData?.gel ?? {};
    
    if (a.op === "tool" && ["poke", "punch", "slap"].includes(a.t)) me.gelTool = a.t;
    if (a.op === "zoom") me.gelZoom = Math.min(1.6, Math.max(0.15, (me.gelZoom ?? 1) * (a.d > 0 ? 0.8 : 1.25))); // 0.15 = about 45 cm from her
    if (a.op === "panel") me.gelPanel = !me.gelPanel;
    if (a.op === "track") me.gelTrack = !me.gelTrack;
    if (a.op === "region") { me.gelRegion = ["chest", "belly", "hips", "thighs"].includes(a.r) ? a.r : null; ctx.emit("gel:set", { k: "sel", v: me.gelRegion }, { to: BODY }); }
    if (a.op === "panel" && !me.gelPanel) ctx.emit("gel:set", { k: "sel", v: null }, { to: BODY });
    if (a.op === "panel" && me.gelPanel && me.gelRegion) ctx.emit("gel:set", { k: "sel", v: me.gelRegion }, { to: BODY });
    if (a.op === "set" && a.k !== "build") ctx.emit("gel:set", { k: a.k, v: a.v, r: me.gelRegion ?? null }, { to: BODY });
    if (a.op === "walk") ctx.emit("gel:walk", { gait: "walk" }, { to: BODY });
    if (a.op === "run") ctx.emit("gel:walk", { gait: "run" }, { to: BODY });
    if (a.op === "home") ctx.emit("gel:home", {}, { to: BODY });
    if (a.op !== "set") ctx.emit("playSound", { clip: SND.tap, volume: 0.35 }, { audience: { player: ctx.self.id } });
    return;
  }
  if (input.released.gelHold && ctx.session.gelPress) { ctx.session.gelPress = false; ctx.emit("gel:release", {}, { to: BODY }); }
  const tap = input.pressed.gelTap, hold = input.pressed.gelHold;
  if (!tap && !hold) return;
  const ray = getInputRay(ctx, input); if (!ray) return;
  let hit = raycast(ctx, ray.origin, ray.direction, { distance: 40, hits: "geometry" });
  if (!onHer(hit)) hit = raycast(ctx, ray.origin, ray.direction, { distance: 40 });
  if (!onHer(hit)) return;
  const kind = hold ? "press" : me.gelTool ?? "poke";
  ctx.emit("gel:hit", { p: hit.position, kind, amp: 1 }, { to: BODY });
  if (hold) ctx.session.gelPress = true;
  ctx.emit("playSound", { clip: SND[kind], position: hit.position, volume: kind === "punch" ? 0.9 : 0.7, pitch: 0.92 + ctx.random() * 0.16 });
  if (kind === "punch") { ctx.emit("cameraPunch", { direction: ray.direction, intensity: 0.35 }, { audience: { player: ctx.self.id } }); ctx.emit("screenShake", { intensity: 0.12, duration: 0.18 }, { audience: { player: ctx.self.id } }); }
  if (kind === "slap") ctx.emit("screenShake", { intensity: 0.05, duration: 0.1 }, { audience: { player: ctx.self.id } });
}
