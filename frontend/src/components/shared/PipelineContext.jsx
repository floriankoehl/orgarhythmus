import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { playSound } from "../../assets/sound_registry";

const PipelineCtx = createContext({ active: false, toggle: () => {} });

/**
 * Global pipeline-mode provider.
 * When active, items can be dragged between IdeaBin ↔ TaskStructure to transform them.
 * Toggled with the 'P' key.
 */
export function PipelineProvider({ children }) {
  const [active, setActive] = useState(false);

  const toggle = useCallback(() => {
    setActive((prev) => {
      playSound(prev ? "ideaClose" : "refactorToggle");
      return !prev;
    });
  }, []);

  // Global 'P' key listener
  useEffect(() => {
    const onKey = (e) => {
      // Don't toggle when typing in inputs/textareas
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "SELECT" ||
        e.target.isContentEditable
      )
        return;
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <PipelineCtx.Provider value={{ active, toggle }}>
      {children}
      {/* ── Bottom-center indicator ── */}
      <PipelineIndicator active={active} toggle={toggle} />
      {/* Hidden DOM marker for drag hooks to detect pipeline state */}
      {active && <div data-pipeline-active style={{ display: "none" }} />}
    </PipelineCtx.Provider>
  );
}

export function usePipeline() {
  return useContext(PipelineCtx);
}

// ── Floating circle indicator ──
function PipelineIndicator({ active, toggle }) {
  return (
    <button
      onClick={toggle}
      title={active ? "Pipeline mode ON — press P to toggle" : "Pipeline mode OFF — press P to toggle"}
      style={{ zIndex: 99999 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-11 h-11 rounded-full
        flex items-center justify-center cursor-pointer select-none
        shadow-lg border-2 transition-all duration-300
        ${
          active
            ? "bg-gradient-to-br from-emerald-400 to-teal-500 border-emerald-300 scale-110 ring-4 ring-emerald-300/40"
            : "bg-gradient-to-br from-gray-400 to-gray-500 border-gray-300 opacity-60 hover:opacity-90"
        }`}
    >
      {/* Pipeline icon — two arrows looping */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow"
      >
        <path d="M5 9l4-4 4 4" />
        <path d="M9 5v8a4 4 0 0 0 4 4h2" />
        <path d="M19 15l-4 4-4-4" />
        <path d="M15 19v-8a4 4 0 0 0-4-4H9" />
      </svg>
    </button>
  );
}
