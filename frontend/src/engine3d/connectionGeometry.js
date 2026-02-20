// engine3d/connectionGeometry.js — 3D bezier ribbon geometry for milestone dependency connections
// ═══════════════════════════════════════════════════════════════════
//
// Computes all geometry needed to render a 3D S-curve ribbon between
// two milestones in world space. No React, no rendering — pure math.
//

// ── Bezier sampling constants ────────────────────────────────────
const BEZIER_SEGMENTS = 14;
const ARROW_SIZE = 12;
const LIFT_Y = 0.5; // vertical lift off the floor (px)

// ── Weight-based ribbon dimensions ──────────────────────────────
const WEIGHT_DIMS = {
  strong:  { ribbonW: 14, beamH: 4 },
  weak:    { ribbonW: 10, beamH: 3 },
  default: { ribbonW: 8,  beamH: 2 },
};

// ── Weight-based ribbon colors ───────────────────────────────────
const WEIGHT_COLORS = {
  strong:  { top: 'rgba(251,146,60,0.92)',  side: 'rgba(200,110,30,0.82)'  },
  weak:    { top: 'rgba(148,163,184,0.78)', side: 'rgba(110,125,150,0.68)' },
  default: { top: 'rgba(134,239,172,0.68)', side: 'rgba(90,190,120,0.58)'  },
};

/**
 * buildConnectionGeometry — compute cubic bezier S-curve geometry for a 3D ribbon.
 *
 * The curve uses an S-shape: control points share the Z midpoint so the ribbon
 * sweeps horizontally between the two milestones (matching the 2D dependency view).
 *
 * @param {Object} conn   — connection descriptor with .weight ('strong' | 'weak' | other)
 * @param {Object} srcMs  — source milestone with .worldX and .worldZ (world-space centre)
 * @param {Object} tgtMs  — target milestone with .worldX and .worldZ (world-space centre)
 * @returns {{
 *   segments: Array<{ pt: {x,z}, next: {x,z}, segLen: number, segAngle: number, sw: number }>,
 *   lastPt: {x, z},
 *   arrowAngle: number,
 *   arrowSize: number,
 *   ribbonW: number,
 *   beamH: number,
 *   liftY: number,
 *   weightColor: string,
 *   weightColorDark: string,
 * }}
 */
export function buildConnectionGeometry(conn, srcMs, tgtMs) {
  // Bezier control points — S-curve matching the 2D dependency view
  const p0x = srcMs.worldX, p0z = srcMs.worldZ;
  const p3x = tgtMs.worldX, p3z = tgtMs.worldZ;
  const midZ = (p0z + p3z) / 2;
  const p1x = p0x, p1z = midZ;
  const p2x = p3x, p2z = midZ;

  // Weight-based visual dimensions
  const key = conn.weight === 'strong' ? 'strong' : conn.weight === 'weak' ? 'weak' : 'default';
  const { ribbonW, beamH } = WEIGHT_DIMS[key];
  const { top: weightColor, side: weightColorDark } = WEIGHT_COLORS[key];

  // Sample the cubic bezier curve
  const points = [];
  for (let i = 0; i <= BEZIER_SEGMENTS; i++) {
    const t = i / BEZIER_SEGMENTS;
    const u = 1 - t;
    points.push({
      x: u*u*u*p0x + 3*u*u*t*p1x + 3*u*t*t*p2x + t*t*t*p3x,
      z: u*u*u*p0z + 3*u*u*t*p1z + 3*u*t*t*p2z + t*t*t*p3z,
    });
  }

  // Build per-segment render data (position, angle, length)
  const segments = [];
  for (let si = 0; si < points.length - 1; si++) {
    const pt = points[si];
    const next = points[si + 1];
    const dx = next.x - pt.x;
    const dz = next.z - pt.z;
    const segLen = Math.sqrt(dx * dx + dz * dz);
    if (segLen < 0.1) continue; // skip degenerate segments
    const segAngle = Math.atan2(dz, dx) * (180 / Math.PI);
    segments.push({ pt, next, segLen, segAngle, sw: segLen + 1 }); // sw: slight overlap to avoid gaps
  }

  // Arrow at the target end
  const lastPt = points[points.length - 1];
  const prevPt = points[points.length - 2];
  const arrowAngle = Math.atan2(lastPt.z - prevPt.z, lastPt.x - prevPt.x) * (180 / Math.PI);

  return {
    segments,
    lastPt,
    arrowAngle,
    arrowSize: ARROW_SIZE,
    ribbonW,
    beamH,
    liftY: LIFT_Y,
    weightColor,
    weightColorDark,
  };
}
