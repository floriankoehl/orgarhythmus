import { useState, useRef, useEffect } from "react";
import {
  Lightbulb,
  LayoutGrid,
  CalendarRange,
  Calendar,
  LayoutDashboard,
  UserCircle,
  Bell,
} from "lucide-react";
import { useWindowManager } from "./WindowManager";
import {
  ORBIT_BREATH_IN_TIME,
  ORBIT_BREATH_OUT_TIME,
  ORBIT_BREATH_TOTAL,
  startOrbitBreathing,
  stopOrbitBreathing,
  ORBIT_HEARTBEAT_DURATION,
  ORBIT_HEARTBEAT_OFFSET,
  startOrbitHeartbeat,
  stopOrbitHeartbeat,
  getHeartbeatTime,
} from "../../assets/sound_registry";

/**
 * Icon config — reuses the same mapping as InventoryBar for consistency.
 */
const ICON_CONFIG = {
  ideaBin:       { Icon: Lightbulb,       label: "Ideas",     gradient: "from-amber-400 to-yellow-500"   },
  profile:       { Icon: UserCircle,      label: "Profile",   gradient: "from-cyan-400 to-blue-600"      },
  notifications: { Icon: Bell,            label: "Alerts",    gradient: "from-slate-600 to-slate-800"    },
  taskStructure: { Icon: LayoutGrid,      label: "Tasks",     gradient: "from-indigo-500 to-violet-600"  },
  schedule:      { Icon: CalendarRange,   label: "Schedule",  gradient: "from-sky-400 to-blue-600"       },
  calendar:      { Icon: Calendar,        label: "Calendar",  gradient: "from-emerald-400 to-teal-600"   },
  overview:      { Icon: LayoutDashboard, label: "Overview",  gradient: "from-amber-400 to-orange-600"   },
};

const ORBIT_RADIUS_BASE = 130;
const ORBIT_RADIUS_PULSE = 4;   // ±px added during breathing (subtle)
const ROTATION_SPEED = 50;      // seconds per full rotation
const HEARTBEAT_WIGGLE_PX = 1.8; // vertical wiggle intensity (very subtle)
const HEARTBEAT_WIGGLE_MS = 120; // how long the wiggle lasts

// ── Background colour shifts ──
// Base slate-900 = rgb(15, 23, 42)
const BG_BASE = [15, 23, 42];
const BG_BREATH_LIFT = 6;       // max RGB lift during breath-in (smooth)
const BG_BEAT_LIFT = 12;        // max RGB lift on heartbeat (sharper)
const BG_BEAT_DECAY_MS = 180;   // how fast the beat flash fades

/** Blend base colour with breathing + beat intensities (both 0→1). */
function bgColor(breathT, beatT) {
  const lift = BG_BREATH_LIFT * breathT + BG_BEAT_LIFT * beatT;
  const r = Math.round(BG_BASE[0] + lift);
  const g = Math.round(BG_BASE[1] + lift);
  const b = Math.round(BG_BASE[2] + lift * 0.7); // keep blue channel slightly cooler
  return `rgb(${r},${g},${b})`;
}

/**
 * OrbitMode — renders when all windows are collapsed.
 *
 * Visual layers:
 *   1. Breathing pulse — orbit radius grows/shrinks in sync with breathing audio
 *   2. Heartbeat wiggle — tiny vertical jitter on each icon when the beat hits
 *
 * Both animations freeze when the user hovers (rotation paused).
 */
export default function OrbitMode() {
  const manager = useWindowManager();
  const containerRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [radius, setRadius] = useState(ORBIT_RADIUS_BASE);
  const [wiggleY, setWiggleY] = useState(0);
  const rafRef = useRef(null);
  const breathStartRef = useRef(null);
  const breathPausedAtRef = useRef(null);   // elapsed-seconds when paused
  const hoveredRef = useRef(false);         // mirrors `hovered` without re-render dep
  const lastBeatIndexRef = useRef(-1);
  const beatFlashRef = useRef(null);        // { start: ms } when a beat flash is active
  const breathEaseRef = useRef(0);          // current breathing ease (0→1→0), used for bg

  // Keep hoveredRef in sync
  useEffect(() => { hoveredRef.current = hovered; }, [hovered]);

  // ── Breathing sound + radius pulse + heartbeat ──
  useEffect(() => {
    startOrbitBreathing();
    startOrbitHeartbeat();
    breathStartRef.current = performance.now();
    breathPausedAtRef.current = null;

    const tick = (now) => {
      // ── Breathing radius + background ──
      if (hoveredRef.current) {
        // Freeze: record where we are so we can resume later
        if (breathPausedAtRef.current === null) {
          breathPausedAtRef.current =
            ((now - breathStartRef.current) / 1000) % ORBIT_BREATH_TOTAL;
        }
      } else {
        // Running: if we were paused, shift start so elapsed stays continuous
        if (breathPausedAtRef.current !== null) {
          breathStartRef.current = now - breathPausedAtRef.current * 1000;
          breathPausedAtRef.current = null;
        }

        const elapsed =
          ((now - breathStartRef.current) / 1000) % ORBIT_BREATH_TOTAL;

        let t;
        if (elapsed < ORBIT_BREATH_IN_TIME) {
          t = elapsed / ORBIT_BREATH_IN_TIME;
          const ease = 0.5 - 0.5 * Math.cos(Math.PI * t);
          setRadius(ORBIT_RADIUS_BASE + ORBIT_RADIUS_PULSE * ease);
          breathEaseRef.current = ease;
        } else {
          t = (elapsed - ORBIT_BREATH_IN_TIME) / ORBIT_BREATH_OUT_TIME;
          const ease = 0.5 - 0.5 * Math.cos(Math.PI * t);
          setRadius(ORBIT_RADIUS_BASE + ORBIT_RADIUS_PULSE * (1 - ease));
          breathEaseRef.current = 1 - ease;
        }
      }

      // ── Heartbeat wiggle + beat flash ──
      if (!hoveredRef.current) {
        const hbt = getHeartbeatTime();
        // Which beat cycle are we in?
        const beatIndex = Math.floor(hbt / ORBIT_HEARTBEAT_DURATION);
        const posInCycle = hbt % ORBIT_HEARTBEAT_DURATION;

        // Fire wiggle when we cross the offset point in a new cycle
        if (
          beatIndex !== lastBeatIndexRef.current &&
          posInCycle >= ORBIT_HEARTBEAT_OFFSET &&
          posInCycle < ORBIT_HEARTBEAT_OFFSET + 0.15
        ) {
          lastBeatIndexRef.current = beatIndex;
          beatFlashRef.current = { start: now };
          // Quick up-down wiggle using a short sine burst
          const wiggleStart = performance.now();
          const runWiggle = () => {
            const dt = performance.now() - wiggleStart;
            if (dt > HEARTBEAT_WIGGLE_MS) {
              setWiggleY(0);
              return;
            }
            // sine burst: one full oscillation over HEARTBEAT_WIGGLE_MS
            const progress = dt / HEARTBEAT_WIGGLE_MS;
            setWiggleY(
              Math.sin(progress * Math.PI * 2) * HEARTBEAT_WIGGLE_PX
            );
            requestAnimationFrame(runWiggle);
          };
          runWiggle();
        }
      }

      // ── Paint background colour directly (avoids extra React re-render) ──
      if (containerRef.current) {
        let beatT = 0;
        if (beatFlashRef.current) {
          const dt = now - beatFlashRef.current.start;
          if (dt < BG_BEAT_DECAY_MS) {
            // sharp attack, exponential-ish decay
            beatT = 1 - dt / BG_BEAT_DECAY_MS;
            beatT = beatT * beatT; // quadratic decay for snappy feel
          } else {
            beatFlashRef.current = null;
          }
        }
        containerRef.current.style.backgroundColor = bgColor(
          breathEaseRef.current,
          beatT
        );
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      stopOrbitBreathing();
      stopOrbitHeartbeat();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!manager) return null;

  const { windowIds, requestOpenFullScreen } = manager;
  const count = windowIds.length;

  const handleClick = (id) => {
    requestOpenFullScreen(id);
  };

  const containerSize = radius * 2 + 56;

  return (
    <div
      ref={containerRef}
      style={{ zIndex: 99980, backgroundColor: bgColor(0, 0) }}
      className="fixed inset-0 flex items-center justify-center"
    >
      {/* Subtle radial glow behind the orbit */}
      <div className="absolute w-[340px] h-[340px] rounded-full bg-slate-800/50 blur-3xl pointer-events-none" />

      {/* Rotating container */}
      <div
        className="relative"
        style={{ width: containerSize, height: containerSize, transition: "width 0.1s, height 0.1s" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setHoveredId(null); }}
      >
        <div
          className="absolute inset-0"
          style={{
            animation: `orbit-spin ${ROTATION_SPEED}s linear infinite`,
            animationPlayState: hovered ? "paused" : "running",
          }}
        >
          {windowIds.map((id, i) => {
            const config = ICON_CONFIG[id];
            if (!config) return null;
            const { Icon, label, gradient } = config;
            const angle = (360 / count) * i;
            const rad = (angle * Math.PI) / 180;
            const cx = radius * Math.cos(rad);
            const cy = radius * Math.sin(rad);
            const isHovered = hoveredId === id;

            return (
              <button
                key={id}
                onClick={() => handleClick(id)}
                onMouseEnter={() => setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`absolute flex flex-col items-center gap-1 transition-transform duration-200 outline-none ${
                  isHovered ? "scale-125" : "scale-100"
                }`}
                style={{
                  left: `calc(50% + ${cx}px - 28px)`,
                  top: `calc(50% + ${cy + wiggleY}px - 28px)`,
                  /* Counter-rotate each icon so they stay upright */
                  animation: `orbit-counter-spin ${ROTATION_SPEED}s linear infinite`,
                  animationPlayState: hovered ? "paused" : "running",
                }}
                title={label}
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient}
                    flex items-center justify-center shadow-2xl
                    transition-all duration-200
                    ${isHovered ? "ring-2 ring-white/40 shadow-white/10" : ""}
                  `}
                >
                  <Icon size={26} className="text-white drop-shadow-lg" />
                </div>
                <span
                  className={`text-[10px] font-medium transition-opacity duration-200 ${
                    isHovered ? "text-white opacity-100" : "text-slate-400 opacity-70"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CSS keyframes for spin / counter-spin */}
      <style>{`
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes orbit-counter-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}
