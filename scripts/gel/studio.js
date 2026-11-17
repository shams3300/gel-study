// The gel studio's room: a round infinity cove. Floor, a curved sweep up into the wall all the way round, a dark ceiling,
// so the light is the softboxes' and she reads against seamless grey from every side.
export function geometry(ctx) {
  const N = ctx.lod <= 1 ? 96 : 48, prof = [[0, 0]];
  for (let i = 0; i <= 8; i++) prof.push([7 + 2.5 * Math.sin((i / 8) * Math.PI / 2), 2.5 - 2.5 * Math.cos((i / 8) * Math.PI / 2)]);
  prof.push([9.5, 6.5]);
  ctx.smooth();
  ctx.color("oklch(0.66 0.004 250)");
  for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < N; j++) {
    const a0 = (j / N) * Math.PI * 2, a1 = ((j + 1) / N) * Math.PI * 2, [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
    const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
    const A = P(r0, y0, a0), B = P(r0, y0, a1), C = P(r1, y1, a1), D = P(r1, y1, a0);
    ctx.quad(...A, ...D, ...C, ...B);
  }
  ctx.flat();
  ctx.color("oklch(0.24 0.005 250)");
  for (let j = 0; j < N; j++) {
    const a0 = (j / N) * Math.PI * 2, a1 = ((j + 1) / N) * Math.PI * 2;
    ctx.tri(0, 6.5, 0, 9.5 * Math.sin(a1), 6.5, 9.5 * Math.cos(a1), 9.5 * Math.sin(a0), 6.5, 9.5 * Math.cos(a0));
  }
}
export function collider() { return [{ kind: "cylinder", radiusTop: 7, radiusBottom: 7, height: 0.2, center: [0, -0.1, 0] }]; }
