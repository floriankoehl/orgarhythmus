import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { RotateCcw } from "lucide-react";

/**
 * DefaultPromptTooltip
 * ─────────────────────
 * Wraps the "reset to default" RotateCcw button.
 * On hover, renders a fixed-position tooltip (via React portal) showing
 * the full default prompt — bypasses any overflow:hidden parent containers.
 *
 * Props:
 *   defaultPrompt  – the default prompt string to display
 *   isCustomised   – whether the current value differs from default (enables reset)
 *   onReset        – callback to call when the button is clicked (only if isCustomised)
 *   size           – icon size (default 8)
 */
export default function DefaultPromptTooltip({ defaultPrompt, isCustomised, onReset, size = 8 }) {
  const [tooltipPos, setTooltipPos] = useState(null);
  const btnRef = useRef(null);

  const handleMouseEnter = useCallback(() => {
    if (!defaultPrompt || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setTooltipPos({
      top: rect.top,
      right: window.innerWidth - rect.right,
    });
  }, [defaultPrompt]);

  const handleMouseLeave = useCallback(() => {
    setTooltipPos(null);
  }, []);

  return (
    <div
      className="flex-shrink-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={btnRef}
        onClick={() => isCustomised && onReset?.()}
        className={`transition-colors ${
          isCustomised
            ? "text-gray-400 hover:text-violet-500 cursor-pointer"
            : "text-gray-200 cursor-default"
        }`}
      >
        <RotateCcw size={size} />
      </button>

      {tooltipPos && defaultPrompt && createPortal(
        <div
          style={{
            position: "fixed",
            top: tooltipPos.top,
            right: tooltipPos.right,
            transform: "translateY(calc(-100% - 6px))",
            zIndex: 99999,
            width: "260px",
            maxHeight: "180px",
          }}
          className="bg-gray-900 text-white text-[9px] rounded px-2.5 py-2 shadow-2xl pointer-events-none overflow-y-auto leading-relaxed whitespace-pre-wrap"
        >
          <div className="text-gray-400 font-semibold text-[8px] mb-1 uppercase tracking-wide">
            Default prompt
          </div>
          {defaultPrompt}
        </div>,
        document.body
      )}
    </div>
  );
}
