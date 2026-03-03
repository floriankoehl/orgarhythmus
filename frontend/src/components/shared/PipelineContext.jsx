import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { playSound } from "../../assets/sound_registry";

const PipelineCtx = createContext({ active: false, toggle: () => {} });

/**
 * Pipeline-mode provider — scoped to project layouts.
 * When active, items can be dragged between IdeaBin ↔ TaskStructure to transform them.
 * Toggled with the 'P' key or from the InventoryBar.
 *
 * The visual indicator is handled by the InventoryBar (no standalone circle).
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
      {/* Hidden DOM marker for drag hooks to detect pipeline state */}
      {active && <div data-pipeline-active style={{ display: "none" }} />}
    </PipelineCtx.Provider>
  );
}

export function usePipeline() {
  return useContext(PipelineCtx);
}
