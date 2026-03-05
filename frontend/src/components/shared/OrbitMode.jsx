import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Lightbulb,
  LayoutGrid,
  CalendarRange,
  Calendar,
  LayoutDashboard,
  UserCircle,
  Bell,
  ArrowLeft,
} from "lucide-react";
import { useWindowManager } from "./WindowManager";
import { fetch_project_detail } from "../../api/org_API";
import {
  ORBIT_BREATH_IN_TIME,
  ORBIT_BREATH_OUT_TIME,
  ORBIT_BREATH_TOTAL,
  startOrbitBreathing,
  stopOrbitBreathing,
  pauseOrbitBreathing,
  resumeOrbitBreathing,
  getBreathingTime,
  ORBIT_HEARTBEAT_DURATION,
  ORBIT_HEARTBEAT_OFFSET,
  startOrbitHeartbeat,
  stopOrbitHeartbeat,
  pauseOrbitHeartbeat,
  resumeOrbitHeartbeat,
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
const ORBIT_RADIUS_PULSE = 4;        // ±px added during breathing (subtle)
const ORBIT_VERTICAL_SHIFT = 18;     // push orbit centre slightly down (px)
const ROTATION_SPEED = 50;           // seconds per full rotation

// ── Background colour shifts (heartbeat only) ──
const BG_BASE = [15, 23, 42]; // slate-900
const BG_BEAT_LIFT = 30;
const BG_BEAT_DECAY_S = 0.25; // seconds (not ms) — keeps everything in audio-time
const BG_BASE_COLOR = `rgb(${BG_BASE.join(',')})`;

function bgGradient(beatT, centerYPct) {
  if (beatT <= 0) return 'none';
  const a = 0.12 * beatT;
  return `radial-gradient(circle at 50% ${centerYPct}%, rgba(140,160,200,${a}) 0%, transparent 40%)`;
}

/**
 * OrbitMode — renders when all windows are collapsed.
 *
 * ★ Sync guarantee: every visual animation is derived from
 *   audio.currentTime — no independent JS timers. When we
 *   pause the audio on hover the currentTime freezes, so the
 *   animation stays bit-perfect in sync forever.
 */
export default function OrbitMode() {
  const manager = useWindowManager();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [radius, setRadius] = useState(ORBIT_RADIUS_BASE);
  const [projectName, setProjectName] = useState("");
  const rafRef = useRef(null);
  const hoveredRef = useRef(false);
  const beatFlashStartRef = useRef(null); // breathing-time when beat fired
  const breathEaseRef = useRef(0);
  const prevHbtRef = useRef(0);       // previous heartbeat time (detect wrap)
  const beatFiredRef = useRef(false);  // already fired in this audio cycle?

  // ── Mirror hover into ref (avoids re-creating effect) ──
  useEffect(() => { hoveredRef.current = hovered; }, [hovered]);

  // ── Pause / resume audio on hover ──
  useEffect(() => {
    if (hovered) {
      pauseOrbitBreathing();
      pauseOrbitHeartbeat();
    } else {
      resumeOrbitBreathing();
      resumeOrbitHeartbeat();
    }
  }, [hovered]);

  // ── Fetch project name ──
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetch_project_detail(projectId)
      .then((p) => { if (!cancelled) setProjectName(p.name || ""); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Main animation loop — reads audio.currentTime as the clock ──
  useEffect(() => {
    startOrbitBreathing();
    startOrbitHeartbeat();

    const tick = () => {
      // ── Breathing (single source of truth: breathing audio position) ──
      const bt = getBreathingTime(); // 0 … ~2.5, loops via audio.loop

      let breathEase = 0;
      if (bt < ORBIT_BREATH_IN_TIME) {
        const t = bt / ORBIT_BREATH_IN_TIME;
        breathEase = 0.5 - 0.5 * Math.cos(Math.PI * t);
      } else {
        const t = (bt - ORBIT_BREATH_IN_TIME) / ORBIT_BREATH_OUT_TIME;
        breathEase = 1 - (0.5 - 0.5 * Math.cos(Math.PI * t));
      }
      breathEaseRef.current = breathEase;
      setRadius(ORBIT_RADIUS_BASE + ORBIT_RADIUS_PULSE * breathEase);

      // ── Heartbeat (single source of truth: heartbeat audio position) ──
      const hbt = getHeartbeatTime(); // 0 … ~1.1, loops via audio.loop

      // Detect audio loop-around (currentTime jumped backward)
      if (hbt < prevHbtRef.current - 0.05) {
        beatFiredRef.current = false;
      }
      prevHbtRef.current = hbt;

      // Detect new beat thump
      if (
        !beatFiredRef.current &&
        hbt >= ORBIT_HEARTBEAT_OFFSET &&
        hbt < ORBIT_HEARTBEAT_OFFSET + 0.15
      ) {
        beatFiredRef.current = true;
        beatFlashStartRef.current = hbt;
      }

      // Compute beat-driven background flash from heartbeat audio time (no drift)
      let beatT = 0; // background flash intensity 0-1
      if (beatFlashStartRef.current !== null) {
        // Elapsed since beat, wrapping back through audio loop
        let dt = hbt - beatFlashStartRef.current;
        if (dt < 0) dt += ORBIT_HEARTBEAT_DURATION; // wrapped around

        // Background flash — quadratic decay
        if (dt < BG_BEAT_DECAY_S) {
          beatT = 1 - dt / BG_BEAT_DECAY_S;
          beatT = beatT * beatT;
        }
        // Clear when animation is done
        if (dt >= BG_BEAT_DECAY_S) {
          beatFlashStartRef.current = null;
        }
      }

      // ── Paint background directly (heartbeat only) ──
      if (containerRef.current) {
        const h = containerRef.current.clientHeight || window.innerHeight;
        const centerYPct = 50 + (ORBIT_VERTICAL_SHIFT / h) * 100;
        containerRef.current.style.backgroundImage = bgGradient(beatT, centerYPct);
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
      style={{ zIndex: 99980, backgroundColor: BG_BASE_COLOR }}
      className="fixed inset-0 flex flex-col items-center justify-center"
    >
      {/* ── Header: back button above centred project name ── */}
      <div className="absolute top-10 flex flex-col items-center gap-2 select-none">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5
                     text-slate-400 hover:text-white hover:bg-white/10
                     transition-colors duration-150 text-sm font-medium"
          title="Back to all projects"
        >
          <ArrowLeft size={18} />
          <span>Projects</span>
        </button>

        {projectName && (
          <h1
            className="text-6xl font-extrabold tracking-tight text-white select-none pointer-events-none"
            style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
          >
            {projectName}
          </h1>
        )}
      </div>

      {/* Subtle radial glow behind the orbit */}
      <div className="absolute w-[340px] h-[340px] rounded-full bg-slate-800/50 blur-3xl pointer-events-none"
           style={{ transform: `translateY(${ORBIT_VERTICAL_SHIFT}px)` }} />

      {/* Rotating container — shifted slightly down */}
      <div
        className="relative"
        style={{
          width: containerSize,
          height: containerSize,
          transition: "width 0.1s, height 0.1s",
          transform: `translateY(${ORBIT_VERTICAL_SHIFT}px)`,
        }}
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
                className={`absolute flex flex-col items-center gap-1 outline-none ${
                  isHovered ? "scale-125" : ""
                }`}
                style={{
                  left: `calc(50% + ${cx}px - 28px)`,
                  top: `calc(50% + ${cy}px - 28px)`,
                  transition: "transform 0.08s ease-out",
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
