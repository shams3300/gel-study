// Gel Studio HUD: the hit you tap with, WALK, the body build, and a drawer of gel sliders, colours and gloss.
// Every press is sendAction("gel", { op, … }) to scripts/gel-player.js; her settings are read off her own state.tune.
const TOOLS = [["poke", "👉", "POKE"], ["punch", "👊", "PUNCH"], ["slap", "✋", "SLAP"]];
const SLIDERS = [["soft", "SOFTNESS", "butter", "jello"], ["dent", "DENT DEPTH", "shallow", "deep"], ["wob", "WOBBLE", "quick", "long"], ["settle", "SETTLE", "slow", "fast"]];
const COLORS = [["white", "#f1efe9"], ["porcelain", "#f2e2d4"], ["light", "#e7c2a3"], ["tan", "#c99671"], ["bronze", "#9a6844"], ["deep", "#5e3c29"], ["amber", "#d8952e"], ["black", "#1e1e22"]];
const REGIONS = [[null, "WHOLE BODY"], ["chest", "CHEST"], ["belly", "BELLY"], ["hips", "HIPS"], ["thighs", "THIGHS"]];
const BUILDS = [["athletic", "ATHLETIC"], ["standard", "STANDARD"], ["tall", "TALL"], ["petite", "PETITE"]];
export function gel(op, extra) { sendAction("gel", { op, ...(extra ?? {}) }); }
export function gelSet(k, v) { sendAction("gel", { op: "set", k, v }); }
const CSS = `<style>
#gel{--ink:#141a22;--paper:#eef0f2;--teal:#38d6c4;font-size:13px;color:var(--paper)}
#gel .plate{background:#1b222cee;border:2px solid #0b0f14;box-shadow:3px 3px 0 #0b0f14;border-radius:6px}
#gel button{pointer-events:auto;font:inherit;color:var(--paper);background:#2a3340;border:2px solid #0b0f14;box-shadow:2px 2px 0 #0b0f14;border-radius:6px;padding:6px 8px;line-height:1.1}
#gel button.on{background:var(--teal);color:var(--ink)}
#gel .lbl{font-size:11px;letter-spacing:.08em;opacity:.75}
#gel input[type=range]{pointer-events:auto;width:100%;accent-color:#38d6c4;height:22px}
#gel .sw{width:26px;height:26px;padding:0;border-radius:50%}
#gel .sw.on{outline:3px solid var(--teal);outline-offset:1px}
@keyframes gfade{to{opacity:0;visibility:hidden}}
</style>`;
export default function (ctx, player) {
  const fid = player.state.gelFocus && ctx.place?.objects?.[player.state.gelFocus] ? player.state.gelFocus : "gel-athletic";
  const b = ctx.place?.objects?.[fid], st = b?.state ?? {}, t = { soft: 1, dent: 1, wob: 1, settle: 1, color: "white", gloss: true, build: "standard", ...(st.tune ?? {}) };
  const tool = player.state.gelTool ?? "poke", open = !!player.state.gelPanel, walking = !!st.walking;
  const right = "calc(var(--spawn-chrome-reservation-right-inset,50px) + 8px)";
  const reg = player.state.gelRegion ?? null, rv = (k) => (reg ? t.rg?.[reg]?.[k] ?? 1 : t[k]);
  const regions = REGIONS.map(([k, lb]) => `<button style="flex:1 0 auto;padding:5px 7px;font-size:11px" class="${reg === k ? "on" : ""}" onclick="gel('region',{r:${k ? `'${k}'` : "null"}})">${lb}</button>`).join("");
  const sliders = SLIDERS.map(([k, lb, lo, hi]) => `<div style="margin-top:6px"><div style="display:flex;justify-content:space-between"><span class="lbl">${lb}</span><b>${reg ? "×" : ""}${Number(rv(k)).toFixed(2)}</b></div>
    <input id="sl-${reg ?? "all"}-${k}" type="range" min="0" max="2" step="0.05" value="${rv(k)}" onchange="gelSet('${k}', this.value)">
    <div style="display:flex;justify-content:space-between;font-size:10px;opacity:.6"><span>${lo}</span><span>1.0</span><span>${hi}</span></div></div>`).join("");
  const colors = COLORS.map(([k, c]) => `<button class="sw ${t.color === k ? "on" : ""}" title="${k}" style="background:${c}" onclick="gelSet('color','${k}')"></button>`).join("");
  return `${CSS}<div id="gel" style="position:fixed;inset:0;pointer-events:none">
  <div style="position:absolute;left:8px;top:calc(8px + var(--spawn-safe-area-top,0px));display:flex;gap:6px;align-items:center">
    <div class="plate" style="padding:5px 10px"><div class="lbl">HALCYON LABS</div><b>GEL STUDY 01</b></div>
  </div>
  <div style="position:absolute;right:${right};top:calc(8px + var(--spawn-safe-area-top,0px));display:flex;flex-direction:column;gap:6px">
    <button onclick="gel('zoom',{d:1})" style="width:40px">＋</button><button onclick="gel('zoom',{d:-1})" style="width:40px">－</button>
    <button onclick="gel('track')" class="${player.state.gelTrack ? "on" : ""}" style="width:40px;font-size:10px;padding:5px 2px">🎥<br>TRACK</button>
  </div>
  <div id="gelhint" class="plate" style="position:absolute;left:8px;right:${right};top:calc(60px + var(--spawn-safe-area-top,0px));padding:6px 10px;text-align:center;animation:gfade .6s 6s forwards">tap her to hit · hold your finger on her to press · drag to look around</div>
  <div style="position:absolute;left:8px;right:${right};bottom:calc(8px + var(--spawn-safe-area-bottom,0px));display:flex;flex-direction:column;gap:6px">
    ${open ? `<div class="plate" style="padding:8px 10px;max-height:52vh;overflow:auto;pointer-events:auto">
      <div class="lbl">REGION</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">${regions}</div>
      ${reg ? `<div style="font-size:11px;opacity:.7;margin-top:4px">${reg} on top of the whole body · lit teal on her</div>` : ""}
      ${sliders}
      <div class="lbl" style="margin-top:8px">COLOR</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${colors}</div>
      <div style="display:flex;gap:6px;margin-top:8px"><button style="flex:1" class="${t.gloss ? "on" : ""}" onclick="gelSet('gloss',1)">GLOSS ${t.gloss ? "ON" : "OFF"}</button><button style="flex:1" onclick="gelSet('reset',1)">${reg ? "RESET " + reg.toUpperCase() : "RESET GEL"}</button></div>
    </div>` : ""}
    <div style="display:flex;gap:4px;font-size:12px">
      ${TOOLS.map(([k, ic, lb]) => `<button style="flex:1" class="${tool === k ? "on" : ""}" onclick="gel('tool',{t:'${k}'})">${ic}<br>${lb}</button>`).join("")}
      ${st.rigless ? "" : `<button style="flex:1" class="${walking && st.gait !== "run" ? "on" : ""}" onclick="gel('walk')">🚶<br>${walking && st.gait !== "run" ? "STOP" : "WALK"}</button>`}
      ${st.rigged ? `<button style="flex:1" class="${walking && st.gait === "run" ? "on" : ""}" onclick="gel('run')">🏃<br>${walking && st.gait === "run" ? "STOP" : "RUN"}</button>` : ""}
      <button style="flex:1" class="${open ? "on" : ""}" onclick="gel('panel')">⚙<br>GEL</button>
    </div>
  </div></div>`;
}
