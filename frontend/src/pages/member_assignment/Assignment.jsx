import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

import {
  fetch_project_teams,
  fetch_project_tasks,
  get_project_days,
  get_all_protopersonas,
  create_protopersona,
  update_protopersona,
  delete_protopersona,
} from '../../api/dependencies_api';

// ── Layout constants ─────────────────────────────────────────────────
const LANE_DEPTH = 1.2;
const LANE_GAP = 0.4;
const CATEGORY_GAP = 2.0;
const LANE_HEIGHT = 0.06;
const UNIT_SIZE = 1;
const DRAG_Y = 0.7;
const LABEL_OFFSET = 2.8;

// ── Color palette ────────────────────────────────────────────────────
const BG_COLOR = '#f8fafc';
const LANE_FILL_COLOR  = '#fafbff';      // near-white with a tiny blue tint
const LANE_BORDER_COLOR = '#e8ecf4';     // soft cool-gray border
const HOVER_LANE_COLOR = '#eef4ff';      // blue-50 tinted
const MILESTONE_FALLBACK = '#facc15';
const DRAGGING_COLOR = '#f59e0b';
const DAY_TICK_COLOR = '#e2e8f0';
const WEEKEND_TICK = '#fecaca';
const TEAM_LABEL_COLOR = '#334155';
const TASK_LABEL_COLOR = '#64748b';
const SKIN_COLOR = '#fcd9b8';
const HAIR_COLORS = ['#4a3728', '#8b6914', '#2c1810', '#c2540a', '#71717a', '#1e293b'];
const MEMBER_PALETTE = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316',
];

// ── Helpers ──────────────────────────────────────────────────────────
function lightenHex(hex, amount = 0.9) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function darkenHex(hex, amount = 0.15) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const nr = Math.round(r * (1 - amount));
  const ng = Math.round(g * (1 - amount));
  const nb = Math.round(b * (1 - amount));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

const DRAG_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// ── Build lane layout from API data ──────────────────────────────────
function buildLaneLayout(teams, tasksById, taskOrder) {
  const items = [];
  let cursor = 0;
  const sorted = [...teams].sort((a, b) => a.order_index - b.order_index);

  sorted.forEach((team, ti) => {
    const tIds = taskOrder[team.id] || [];
    if (tIds.length === 0) {
      items.push({
        id: `empty-${team.id}`,
        taskId: null,
        label: '(no tasks)',
        milestones: [],
        teamId: team.id,
        teamLabel: team.name,
        teamColor: team.color || '#94a3b8',
        z: cursor,
        isFirstInTeam: true,
      });
      cursor -= LANE_DEPTH + LANE_GAP;
    } else {
      tIds.forEach((taskId, idx) => {
        const task = tasksById[taskId];
        if (!task) return;
        const ms = (task.milestones || []).map((m) => ({
          id: m.id,
          name: m.name,
          start: m.start_index,
          end: m.start_index + m.duration,
          color: m.color || team.color || MILESTONE_FALLBACK,
        }));
        items.push({
          id: `task-${task.id}`,
          taskId: task.id,
          label: task.name,
          milestones: ms,
          teamId: team.id,
          teamLabel: team.name,
          teamColor: team.color || '#94a3b8',
          z: cursor,
          isFirstInTeam: idx === 0,
        });
        cursor -= LANE_DEPTH + LANE_GAP;
      });
    }
    if (ti < sorted.length - 1) {
      cursor += LANE_GAP;
      cursor -= CATEGORY_GAP;
    }
  });

  if (items.length === 0) return [];
  const first = items[0].z;
  const last = items[items.length - 1].z;
  const centre = (first + last) / 2;
  return items.map((l) => ({ ...l, z: l.z - centre }));
}

function nearestLaneIdx(layout, wz) {
  let best = 0, bestD = Infinity;
  layout.forEach((l, i) => {
    const d = Math.abs(wz - l.z);
    if (d < bestD) { bestD = d; best = i; }
  });
  return bestD > LANE_DEPTH / 2 + LANE_GAP ? -1 : best;
}

function worldXToUnit(wx, half) {
  return Math.max(0, Math.min(half * 2, Math.round((wx + half) / UNIT_SIZE)));
}

// Snap world-X to the centre of the nearest day cell
function snapWorldX(wx, half) {
  const day = worldXToUnit(wx, half);
  return (day + 0.5) * UNIT_SIZE - half;
}

// ── 3-D sub-components ───────────────────────────────────────────────

/* Lane floor — light tinted rounded box with smooth border */
function LaneFloor({ z, length, highlight, teamColor }) {
  const fillColor = highlight ? HOVER_LANE_COLOR : LANE_FILL_COLOR;
  const borderCol = highlight ? '#c7d8f4' : LANE_BORDER_COLOR;
  return (
    <group position={[0, 0, z]}>
      {/* Smooth outer border */}
      <RoundedBox args={[length + 0.06, LANE_HEIGHT + 0.018, LANE_DEPTH + 0.06]} radius={0.09} smoothness={4}>
        <meshStandardMaterial color={borderCol} />
      </RoundedBox>
      {/* Fill */}
      <RoundedBox args={[length, LANE_HEIGHT, LANE_DEPTH]} radius={0.08} smoothness={4} position={[0, 0.004, 0]}>
        <meshStandardMaterial color={fillColor} />
      </RoundedBox>
      {/* Team color accent — thin line at the front edge */}
      <RoundedBox
        args={[length, 0.025, 0.06]}
        radius={0.012}
        smoothness={2}
        position={[0, LANE_HEIGHT / 2 + 0.006, LANE_DEPTH / 2 - 0.02]}
      >
        <meshStandardMaterial color={teamColor} transparent opacity={0.45} />
      </RoundedBox>
    </group>
  );
}

/* Milestone segment */
function MilestoneSegment({ start, end, z, halfLength, color, name }) {
  const len = (end - start) * UNIT_SIZE;
  const cx = ((start + end) / 2) * UNIT_SIZE - halfLength;
  const h = 0.16;
  return (
    <group position={[cx, LANE_HEIGHT / 2 + h / 2 + 0.008, z]}>
      <RoundedBox args={[len, h, LANE_DEPTH * 0.82]} radius={0.04} smoothness={2}>
        <meshStandardMaterial color={color} transparent opacity={0.88} />
      </RoundedBox>
      {len > 1.5 && (
        <Text
          position={[0, h / 2 + 0.06, LANE_DEPTH * 0.82 / 2 + 0.01]}
          fontSize={0.18}
          color="#334155"
          anchorX="center"
          anchorY="bottom"
          maxWidth={len - 0.3}
        >
          {name}
        </Text>
      )}
    </group>
  );
}

/* ── Protopersona — proper low-poly human ──────────────────────────── */
function Persona({ worldX, z, color, isDragging, onPointerDown, name, hairColor }) {
  const groupRef = useRef();
  const skinCol = SKIN_COLOR;
  const clothCol = isDragging ? DRAGGING_COLOR : color;
  const clothDark = isDragging ? DRAGGING_COLOR : darkenHex(color, 0.18);
  const limbSkin = isDragging ? DRAGGING_COLOR : skinCol;
  const hair = isDragging ? DRAGGING_COLOR : hairColor;

  // Idle animation — gentle breathing + sway
  useFrame(({ clock }) => {
    if (groupRef.current && !isDragging) {
      const t = clock.getElapsedTime();
      groupRef.current.position.y =
        LANE_HEIGHT / 2 + 0.01 + Math.sin(t * 1.4) * 0.015;
      groupRef.current.rotation.y = Math.sin(t * 0.7) * 0.04;
    }
  });

  const baseY = isDragging ? DRAG_Y : LANE_HEIGHT / 2 + 0.01;

  return (
    <group
      ref={groupRef}
      position={[worldX, baseY, z]}
      onPointerDown={onPointerDown}
    >
      {/* ── Legs ── */}
      {/* Left leg */}
      <RoundedBox args={[0.11, 0.32, 0.11]} radius={0.04} smoothness={2} position={[-0.08, 0.16, 0]}>
        <meshStandardMaterial color={clothDark} />
      </RoundedBox>
      {/* Left shoe */}
      <RoundedBox args={[0.12, 0.06, 0.16]} radius={0.025} smoothness={2} position={[-0.08, 0.02, 0.02]}>
        <meshStandardMaterial color="#374151" />
      </RoundedBox>
      {/* Right leg */}
      <RoundedBox args={[0.11, 0.32, 0.11]} radius={0.04} smoothness={2} position={[0.08, 0.16, 0]}>
        <meshStandardMaterial color={clothDark} />
      </RoundedBox>
      {/* Right shoe */}
      <RoundedBox args={[0.12, 0.06, 0.16]} radius={0.025} smoothness={2} position={[0.08, 0.02, 0.02]}>
        <meshStandardMaterial color="#374151" />
      </RoundedBox>

      {/* ── Torso ── */}
      <RoundedBox args={[0.32, 0.34, 0.2]} radius={0.06} smoothness={3} position={[0, 0.50, 0]}>
        <meshStandardMaterial color={clothCol} />
      </RoundedBox>

      {/* ── Arms ── */}
      {/* Left upper arm */}
      <RoundedBox args={[0.09, 0.22, 0.09]} radius={0.035} smoothness={2} position={[-0.22, 0.52, 0]}>
        <meshStandardMaterial color={clothCol} />
      </RoundedBox>
      {/* Left forearm (skin) */}
      <RoundedBox args={[0.08, 0.16, 0.08]} radius={0.03} smoothness={2} position={[-0.22, 0.33, 0]}>
        <meshStandardMaterial color={limbSkin} />
      </RoundedBox>
      {/* Right upper arm */}
      <RoundedBox args={[0.09, 0.22, 0.09]} radius={0.035} smoothness={2} position={[0.22, 0.52, 0]}>
        <meshStandardMaterial color={clothCol} />
      </RoundedBox>
      {/* Right forearm (skin) */}
      <RoundedBox args={[0.08, 0.16, 0.08]} radius={0.03} smoothness={2} position={[0.22, 0.33, 0]}>
        <meshStandardMaterial color={limbSkin} />
      </RoundedBox>

      {/* ── Neck ── */}
      <mesh position={[0, 0.70, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.06, 8]} />
        <meshStandardMaterial color={skinCol} />
      </mesh>

      {/* ── Head ── */}
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color={skinCol} />
      </mesh>

      {/* ── Hair ── */}
      <mesh position={[0, 0.90, -0.02]}>
        <sphereGeometry args={[0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={hair} />
      </mesh>

      {/* ── Eyes ── */}
      <mesh position={[-0.045, 0.83, 0.12]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.045, 0.83, 0.12]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* ── Name tag ── */}
      {name && (
        <group position={[0, 1.08, 0]}>
          {/* Tag background */}
          <RoundedBox args={[name.length * 0.1 + 0.2, 0.18, 0.02]} radius={0.04} smoothness={2}>
            <meshStandardMaterial color="#ffffff" transparent opacity={0.92} />
          </RoundedBox>
          <Text
            position={[0, 0, 0.02]}
            fontSize={0.11}
            color="#334155"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.005}
            outlineColor="#ffffff"
          >
            {name}
          </Text>
        </group>
      )}
    </group>
  );
}

/* Day tick lines & labels */
function DayTicks({ totalDays, halfLength, laneLayout, daysList }) {
  const ticks = useMemo(() => {
    if (totalDays === 0 || laneLayout.length === 0) return null;
    const topZ = Math.max(...laneLayout.map((l) => l.z)) + LANE_DEPTH / 2 + 0.25;
    const botZ = Math.min(...laneLayout.map((l) => l.z)) - LANE_DEPTH / 2 - 0.25;
    const span = topZ - botZ;
    const midZ = (topZ + botZ) / 2;
    const dayMap = {};
    if (daysList) daysList.forEach((d) => { dayMap[d.day_index] = d; });

    const els = [];
    for (let d = 0; d <= totalDays; d++) {
      const x = d * UNIT_SIZE - halfLength;
      const info = dayMap[d];
      const isWE = info?.is_weekend;

      els.push(
        <mesh key={`t${d}`} position={[x, LANE_HEIGHT / 2 + 0.002, midZ]}>
          <boxGeometry args={[0.015, 0.003, span]} />
          <meshStandardMaterial
            color={isWE ? WEEKEND_TICK : DAY_TICK_COLOR}
            transparent
            opacity={isWE ? 0.5 : 0.22}
          />
        </mesh>,
      );

      if (d % 5 === 0 || d === 1) {
        const lbl = info?.day_name_short ? `${d + 1}\n${info.day_name_short}` : `${d + 1}`;
        els.push(
          <Text key={`l${d}`} position={[x, 0.12, topZ + 0.55]} fontSize={0.24} color="#94a3b8" anchorX="center" anchorY="middle">
            {lbl}
          </Text>,
        );
      }
    }
    return els;
  }, [totalDays, halfLength, laneLayout, daysList]);
  return <>{ticks}</>;
}

/* Team + Task side labels */
function SideLabels({ laneLayout, halfLength }) {
  const labels = useMemo(() => {
    const seen = new Set();
    const teamGroups = laneLayout.filter((l) => {
      if (l.isFirstInTeam && !seen.has(l.teamId)) { seen.add(l.teamId); return true; }
      return false;
    });

    const els = [];

    teamGroups.forEach((lane) => {
      const teamLanes = laneLayout.filter((l) => l.teamId === lane.teamId);
      const cz = teamLanes.reduce((s, l) => s + l.z, 0) / teamLanes.length;

      // Vertical color bar
      const barDepth = teamLanes.length * (LANE_DEPTH + LANE_GAP) - LANE_GAP + 0.3;
      els.push(
        <group key={`bar-${lane.teamId}`} position={[-halfLength - LABEL_OFFSET + 0.85, LANE_HEIGHT / 2 + 0.01, cz]}>
          <RoundedBox args={[0.18, 0.06, barDepth]} radius={0.03} smoothness={2}>
            <meshStandardMaterial color={lane.teamColor} />
          </RoundedBox>
        </group>,
      );

      els.push(
        <Text
          key={`tn-${lane.teamId}`}
          position={[-halfLength - LABEL_OFFSET - 0.15, 0.16, cz]}
          fontSize={0.38}
          fontWeight="bold"
          color={TEAM_LABEL_COLOR}
          anchorX="right"
          anchorY="middle"
          maxWidth={7}
        >
          {lane.teamLabel}
        </Text>,
      );
    });

    laneLayout.forEach((lane) => {
      els.push(
        <Text
          key={`tl-${lane.id}`}
          position={[-halfLength - 0.35, 0.1, lane.z]}
          fontSize={0.24}
          color={TASK_LABEL_COLOR}
          anchorX="right"
          anchorY="middle"
          maxWidth={5.5}
        >
          {lane.label}
        </Text>,
      );
    });

    return els;
  }, [laneLayout, halfLength]);
  return <>{labels}</>;
}

// ── Easing helpers ───────────────────────────────────────────────────
function easeInOutQuart(t) {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

// ── 2D Dependency-page layout constants (mirrored from layoutMath.js) ─
const DEP_SIDEBAR_PX = 350;   // TEAMWIDTH(150) + TASKWIDTH(200)
const DEP_DAY_PX     = 60;    // DEFAULT_DAYWIDTH
const DEP_ROW_PX     = 32;    // DEFAULT_TASKHEIGHT_NORMAL
const DEP_HEADER_PX  = 48;    // HEADER_HEIGHT

// ── Intro camera flight ──────────────────────────────────────────────
//
// Goal: bird's-eye starting frame has the *exact same proportions*
// (width × height rectangle) as the 2D Dependency Gantt chart.
//
//  1. Compute the 2D chart pixel dimensions (deterministic).
//  2. Clip to the canvas viewport (handle overflow).
//  3. Map those proportions to 3D world-space.
//  4. Derive camera height + XZ offset from perspective math.
//  5. Sweep to the final 3D angle with easeInOutQuart.
//
const INTRO_DURATION = 2.5; // seconds

function CameraIntro({ targetPos, totalDays, laneCount, controlsRef }) {
  const { camera, size } = useThree();
  const progress    = useRef(0);
  const startPos    = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endPos      = useRef(new THREE.Vector3());
  const endTarget   = useRef(new THREE.Vector3(0, 0, 0));
  const done        = useRef(false);
  const started     = useRef(false);

  useEffect(() => {
    const canvasW = size.width;
    const canvasH = size.height;
    const aspect  = canvasW / canvasH;
    const FOV     = 45;
    const tanHalf = Math.tan((FOV * Math.PI) / 360); // tan(fov/2)

    // ── 1. Full 2D chart dimensions (px) ─────────────────────────
    const chart2dW = DEP_SIDEBAR_PX + totalDays * DEP_DAY_PX;
    const chart2dH = DEP_HEADER_PX  + laneCount * DEP_ROW_PX;

    // ── 2. Visible portion (clipped to viewport like scroll=0) ───
    const visW = Math.min(chart2dW, canvasW);
    const visH = Math.min(chart2dH, canvasH);

    // What fraction of the canvas does the visible chart occupy?
    const fillX = visW / canvasW;   // 0..1
    const fillY = visH / canvasH;   // 0..1

    // ── 3. 3D board world-space dimensions ───────────────────────
    // The board (lanes) maps to the *grid area* of the 2D chart
    // (everything right of the sidebar and below the header).
    const boardW = totalDays * UNIT_SIZE;
    const boardD = laneCount * (LANE_DEPTH + LANE_GAP);

    // Include the 3D side-labels region (≈ sidebar in 2D)
    const labelsW     = LABEL_OFFSET + 1.0;        // world units for labels
    const totalWorldW = labelsW + boardW;           // full 3D "chart" width
    const totalWorldH = boardD + 1.0;               // +1 for day header labels

    // ── 4. Camera height so the visible area matches ─────────────
    // Perspective camera looking down at height h:
    //   visibleWorldH = 2·h·tan(fov/2)
    //   visibleWorldW = visibleWorldH · aspect
    //
    // We want: totalWorldW = fillX · visibleWorldW
    //          totalWorldH = fillY · visibleWorldH
    //
    //   h_from_height = totalWorldH / (fillY · 2 · tanHalf)
    //   h_from_width  = totalWorldW / (fillX · 2 · tanHalf · aspect)
    //
    // Use max so both axes fit:
    const hFromH = totalWorldH / (fillY * 2 * tanHalf);
    const hFromW = totalWorldW / (fillX * 2 * tanHalf * aspect);
    const birdH  = Math.max(hFromH, hFromW);

    // ── 5. Camera XZ offset for overflow ─────────────────────────
    // If the 2D chart overflows, we show from the top-left corner
    // (equivalent to scroll position = 0).
    const visWorldH = 2 * birdH * tanHalf;
    const visWorldW = visWorldH * aspect;

    // Board is centered at (0, 0). Offset to align top-left edge.
    const boardLeft = -boardW / 2 - labelsW;   // left edge with labels
    const boardTop  =  boardD / 2 + 0.5;       // front edge (positive Z)

    const overflowX = chart2dW > canvasW;
    const overflowY = chart2dH > canvasH;

    const camX = overflowX ? (boardLeft + visWorldW / 2) : 0;
    const camZ = overflowY ? (boardTop  - visWorldH / 2) : 0;

    // ── Set start / end ──────────────────────────────────────────
    startPos.current.set(camX, birdH, camZ + 0.001);
    startTarget.current.set(camX, 0, camZ);

    endPos.current.set(targetPos[0], targetPos[1], targetPos[2]);
    endTarget.current.set(0, 0, 0);

    camera.position.copy(startPos.current);
    camera.fov = FOV;
    camera.updateProjectionMatrix();
    camera.lookAt(startTarget.current.x, 0, startTarget.current.z);

    if (controlsRef.current) {
      controlsRef.current.target.copy(startTarget.current);
      controlsRef.current.enabled = false;
      controlsRef.current.update();
    }

    started.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (done.current || !started.current) return;

    progress.current += delta / INTRO_DURATION;
    const t = Math.min(progress.current, 1);
    const e = easeInOutQuart(t);

    // Lerp position
    camera.position.lerpVectors(startPos.current, endPos.current, e);

    // Lerp look-at target (offset → origin)
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(startTarget.current, endTarget.current, e);
      controlsRef.current.update();
    }

    if (t >= 1) {
      done.current = true;
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    }
  });

  return null;
}

// ── Scene ────────────────────────────────────────────────────────────

function Scene({ laneLayout, totalDays, daysList, personas, onMovePersona, cameraMode, cameraTarget }) {
  const controlsRef = useRef();
  const { camera, gl } = useThree();
  const ray = useRef(new THREE.Raycaster());
  const dragRef = useRef({ id: null });
  const [dragId, setDragId] = useState(null);
  const [dragWP, setDragWP] = useState([0, 0]);
  const [hoverIdx, setHoverIdx] = useState(-1);

  const half = totalDays / 2;
  const laneLen = totalDays * UNIT_SIZE;

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    // Default: scroll-wheel orbits, left-click drags personas, right-click pans
    // Hold Space: left-click pans
    // Hold R: left-click orbits
    if (cameraMode === 'rotate') {
      c.enabled = true;
      c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
    } else if (cameraMode === 'pan') {
      c.enabled = true;
      c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
    } else {
      c.enabled = true;
      c.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
    }
  }, [cameraMode]);

  const worldPt = useCallback((ne) => {
    const r = gl.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((ne.clientX - r.left) / r.width) * 2 - 1, -((ne.clientY - r.top) / r.height) * 2 + 1);
    ray.current.setFromCamera(m, camera);
    const h = new THREE.Vector3();
    ray.current.ray.intersectPlane(DRAG_PLANE, h);
    return h;
  }, [camera, gl]);

  const startDrag = useCallback((id, e) => {
    e.stopPropagation();
    if (cameraMode !== 'select') return;
    dragRef.current.id = id;
    setDragId(id);
    gl.domElement.setPointerCapture(e.pointerId);
    const h = worldPt(e.nativeEvent ?? e);
    setDragWP([h.x, h.z]);
    setHoverIdx(nearestLaneIdx(laneLayout, h.z));
  }, [gl, worldPt, cameraMode, laneLayout]);

  const moveDrag = useCallback((e) => {
    if (!dragRef.current.id) return;
    const h = worldPt(e);
    // Snap X to day grid while dragging
    const snappedX = snapWorldX(h.x, half);
    // Snap Z to nearest lane
    const li = nearestLaneIdx(laneLayout, h.z);
    const snappedZ = li >= 0 ? laneLayout[li].z : h.z;
    setDragWP([snappedX, snappedZ]);
    setHoverIdx(li);
  }, [worldPt, laneLayout, half]);

  const endDrag = useCallback((e) => {
    if (!dragRef.current.id) return;
    const h = worldPt(e);
    const tl = nearestLaneIdx(laneLayout, h.z);
    const tx = worldXToUnit(h.x, half);
    if (tl >= 0) onMovePersona(dragRef.current.id, tl, tx);
    dragRef.current.id = null;
    setDragId(null);
    setHoverIdx(-1);
    gl.domElement.releasePointerCapture(e.pointerId);
  }, [worldPt, onMovePersona, gl, laneLayout, half]);

  const lanes = useMemo(() =>
    laneLayout.map((lane, i) => (
      <group key={lane.id}>
        <LaneFloor
          z={lane.z}
          length={laneLen}
          highlight={i === hoverIdx && dragId !== null}
          teamColor={lane.teamColor}
        />
        {lane.milestones.map((ms) => (
          <MilestoneSegment
            key={ms.id}
            start={ms.start}
            end={ms.end}
            z={lane.z}
            halfLength={half}
            color={ms.color}
            name={ms.name}
          />
        ))}
      </group>
    )),
  [laneLayout, laneLen, half, hoverIdx, dragId]);

  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[12, 22, 14]} intensity={0.3} />
      <directionalLight position={[-8, 12, -8]} intensity={0.12} />
      <hemisphereLight groundColor="#f1f5f9" intensity={0.3} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableZoom={false}
        enablePan
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={0.15}
        minDistance={5}
        maxDistance={120}
      />

      {/* Intro fly-in animation */}
      <CameraIntro
        targetPos={cameraTarget}
        totalDays={totalDays}
        laneCount={laneLayout.length}
        controlsRef={controlsRef}
      />

      {lanes}
      <DayTicks totalDays={totalDays} halfLength={half} laneLayout={laneLayout} daysList={daysList} />
      <SideLabels laneLayout={laneLayout} halfLength={half} />

      {/* Personas */}
      {personas.map((p) => {
        const isDragging = p.id === dragId;
        // Resolve lane index from task FK
        const pLaneIdx = p.task != null
          ? laneLayout.findIndex((l) => l.taskId === p.task)
          : 0;
        const safeLaneIdx = pLaneIdx >= 0 ? pLaneIdx : 0;
        // Snapped position: center of the day cell
        const wx = isDragging ? dragWP[0] : (p.day_index + 0.5) * UNIT_SIZE - half;
        const wz = isDragging ? dragWP[1] : laneLayout[safeLaneIdx]?.z ?? 0;
        return (
          <Persona
            key={p.id}
            worldX={wx}
            z={wz}
            color={p.color}
            name={p.name}
            hairColor={p.hair_color}
            isDragging={isDragging}
            onPointerDown={(e) => startDrag(p.id, e)}
          />
        );
      })}

      {/* Invisible drag plane */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} onPointerMove={moveDrag} onPointerUp={endDrag}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function Assignment() {
  const { projectId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teams, setTeams] = useState([]);
  const [tasksById, setTasksById] = useState({});
  const [taskOrder, setTaskOrder] = useState({});
  const [totalDays, setTotalDays] = useState(0);
  const [daysList, setDaysList] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [cameraMode, setCameraMode] = useState('select');
  const [showHeader, setShowHeader] = useState(false);

  // ── Hide layout headers while this page is mounted ─────────────────
  useEffect(() => {
    const orgaHeader = document.querySelector('[data-orga-header]');
    const projectHeader = document.querySelector('[data-project-header]');
    const orgaMain = document.querySelector('[data-orga-main]');

    if (orgaHeader) orgaHeader.style.display = 'none';
    if (projectHeader) projectHeader.style.display = showHeader ? '' : 'none';
    if (orgaMain) { orgaMain.style.marginTop = '0'; orgaMain.style.minHeight = '0'; }
    document.body.style.overflow = 'hidden';

    return () => {
      if (orgaHeader) orgaHeader.style.display = '';
      if (projectHeader) projectHeader.style.display = '';
      if (orgaMain) { orgaMain.style.marginTop = ''; orgaMain.style.minHeight = ''; }
      document.body.style.overflow = '';
    };
  }, [showHeader]);

  // ── Fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [tRes, tkRes, dRes, pRes] = await Promise.all([
          fetch_project_teams(projectId),
          fetch_project_tasks(projectId),
          get_project_days(projectId),
          get_all_protopersonas(projectId),
        ]);
        setTeams(tRes.teams || []);
        setTasksById(tkRes.tasks || {});
        setTaskOrder(tkRes.taskOrder || {});
        setTotalDays(dRes.total_days || 0);
        setDaysList(dRes.days_list || []);
        setPersonas(pRes.protopersonas || []);
      } catch (err) {
        console.error('Assignment: load failed', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const laneLayout = useMemo(() => buildLaneLayout(teams, tasksById, taskOrder), [teams, tasksById, taskOrder]);

  // ── Persona actions ────────────────────────────────────────────────
  // Helper: resolve a lane index from a task ID
  const laneIdxForTask = useCallback((taskId) => {
    if (taskId == null) return 0;
    const idx = laneLayout.findIndex((l) => l.taskId === taskId);
    return idx >= 0 ? idx : 0;
  }, [laneLayout]);

  const addPersona = useCallback(async () => {
    const idx = personas.length;
    const color = MEMBER_PALETTE[idx % MEMBER_PALETTE.length];
    const hairColor = HAIR_COLORS[idx % HAIR_COLORS.length];
    const firstTask = laneLayout[0]?.taskId ?? null;
    const dayIdx = Math.floor((totalDays || 10) / 2);
    try {
      const res = await create_protopersona(projectId, {
        name: `Persona ${idx + 1}`,
        color,
        hair_color: hairColor,
        task: firstTask,
        day_index: dayIdx,
      });
      setPersonas((prev) => [...prev, res.protopersona]);
    } catch (err) {
      console.error('Failed to create protopersona', err);
    }
  }, [projectId, personas, laneLayout, totalDays]);

  const movePersona = useCallback(async (id, laneIdx, x) => {
    const taskId = laneLayout[laneIdx]?.taskId ?? null;
    // Optimistic update
    setPersonas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, task: taskId, day_index: x } : p)),
    );
    try {
      await update_protopersona(projectId, id, { task: taskId, day_index: x });
    } catch (err) {
      console.error('Failed to update protopersona', err);
    }
  }, [projectId, laneLayout]);

  const removePersona = useCallback(async (id) => {
    setPersonas((prev) => prev.filter((p) => p.id !== id));
    try {
      await delete_protopersona(projectId, id);
    } catch (err) {
      console.error('Failed to delete protopersona', err);
    }
  }, [projectId]);

  // ── Keyboard ───────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return;
      if (e.code === 'Space') { e.preventDefault(); setCameraMode('pan'); }
      if (e.key === 'r' || e.key === 'R') setCameraMode('rotate');
    };
    const up = (e) => {
      if (e.code === 'Space' || e.key === 'r' || e.key === 'R') setCameraMode('select');
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ── Loading / error / empty ────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex w-full items-center justify-center" style={{ height: '100dvh' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-sm text-slate-400">Loading 3D Gantt…</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex w-full items-center justify-center" style={{ height: '100dvh' }}>
        <p className="text-sm text-red-500">Error: {error}</p>
      </div>
    );
  }
  if (laneLayout.length === 0) {
    return (
      <div className="flex w-full items-center justify-center" style={{ height: '100dvh' }}>
        <p className="text-sm text-slate-400">No teams or tasks found for this project.</p>
      </div>
    );
  }

  const camY = Math.max(18, totalDays * 0.35);
  const camZ = Math.max(16, laneLayout.length * 1.8);

  return (
    <div className="flex w-full flex-col overflow-hidden" style={{ height: '100dvh' }}>
      {/* ── Header toggle ───────────────────────────────────────── */}
      <button
        onClick={() => setShowHeader((v) => !v)}
        className="fixed left-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/70 text-white shadow-lg backdrop-blur transition hover:bg-slate-800"
        title={showHeader ? 'Hide navigation' : 'Show navigation'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {showHeader ? (
            <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
          ) : (
            <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
          )}
        </svg>
      </button>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="z-10 flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-1.5 text-sm pl-14">
        <span className="font-semibold text-slate-700">3D Gantt</span>
        <span className="h-4 w-px bg-slate-200" />

        <span className="text-slate-400 text-xs">
          {teams.length} team{teams.length !== 1 ? 's' : ''} · {Object.keys(tasksById).length} tasks · {totalDays} days
        </span>

        <span className="h-4 w-px bg-slate-200" />

        {/* Create persona */}
        <button
          onClick={addPersona}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="16" y1="11" x2="22" y2="11" />
          </svg>
          Add Protopersona
        </button>

        {/* Persona chips */}
        {personas.length > 0 && (
          <>
            <span className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {personas.map((p) => (
                <span
                  key={p.id}
                  className="group flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name}
                  <button
                    onClick={() => removePersona(p.id)}
                    className="ml-0.5 rounded-full opacity-60 transition hover:opacity-100"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </span>
              ))}
            </div>
          </>
        )}

        <div className="flex-1" />

        <span className="text-slate-400 text-xs hidden md:inline-flex items-center gap-1.5">
          Scroll orbit ·
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-slate-500">Space</kbd>
          + drag pan ·
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[10px] text-slate-500">R</kbd>
          + drag orbit
        </span>

        {cameraMode !== 'select' && (
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
            {cameraMode === 'pan' ? 'Pan' : 'Orbit'}
          </span>
        )}
      </div>

      {/* ── Canvas ──────────────────────────────────────────────── */}
      <div className="relative flex-1" style={{ touchAction: 'none' }}>
        <Canvas
          camera={{ position: [0, camY, camZ], fov: 45 }}
          style={{ background: BG_COLOR }}
          onCreated={({ gl }) => { gl.domElement.style.touchAction = 'none'; }}
        >
          <Scene
            laneLayout={laneLayout}
            totalDays={totalDays}
            daysList={daysList}
            personas={personas}
            onMovePersona={movePersona}
            cameraMode={cameraMode}
            cameraTarget={[0, camY, camZ]}
          />
        </Canvas>
      </div>
    </div>
  );
}
