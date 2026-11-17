// The standard gel figure: scripts/gel/body-lib.js builds every body; this file names the build.
import { BUILDS, buildGeometry, skeletonFor, colliderFor } from "./body-lib.js";
const B = BUILDS.standard;
export function skeleton() { return skeletonFor(B); }
export function geometry(ctx) { return buildGeometry(ctx, B); }
export function collider() { return colliderFor(B); }
