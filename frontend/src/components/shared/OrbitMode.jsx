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

const ORBIT_RADIUS = 130;
const ROTATION_SPEED = 20; // seconds per full rotation

/**
 * OrbitMode — renders when all windows are collapsed.
 *
 * Shows all window icons rotating in a circle at the center of the screen.
 * Hover near the orbit to pause rotation, click an icon to open it full-screen.
 * Background matches the inventory bar color (slate-900).
 */
export default function OrbitMode() {
  const manager = useWindowManager();
  const containerRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  if (!manager) return null;

  const { windowIds, requestOpenFullScreen } = manager;
  const count = windowIds.length;

  const handleClick = (id) => {
    requestOpenFullScreen(id);
  };

  return (
    <div
      ref={containerRef}
      style={{ zIndex: 99980 }}
      className="fixed inset-0 flex items-center justify-center bg-slate-900 transition-colors duration-500"
    >
      {/* Subtle radial glow behind the orbit */}
      <div className="absolute w-[340px] h-[340px] rounded-full bg-slate-800/50 blur-3xl pointer-events-none" />

      {/* Orbit ring (visual guide) */}
      <div
        className="absolute rounded-full border border-slate-700/30 pointer-events-none"
        style={{ width: ORBIT_RADIUS * 2 + 56, height: ORBIT_RADIUS * 2 + 56 }}
      />

      {/* Rotating container */}
      <div
        className="relative"
        style={{ width: ORBIT_RADIUS * 2 + 56, height: ORBIT_RADIUS * 2 + 56 }}
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
            const cx = ORBIT_RADIUS * Math.cos(rad);
            const cy = ORBIT_RADIUS * Math.sin(rad);
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
                  top: `calc(50% + ${cy}px - 28px)`,
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
