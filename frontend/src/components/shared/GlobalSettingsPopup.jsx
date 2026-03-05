import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useAutoRefreshSetting, setAutoRefresh } from "../../api/dataEvents";

/**
 * GlobalSettingsPopup — accessible from the InventoryBar gear icon.
 * Currently holds the auto-refresh toggle; can be extended with more settings.
 */
export default function GlobalSettingsPopup({ onClose }) {
  const autoRefresh = useAutoRefreshSetting();
  const popupRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      className="absolute bottom-full mb-2 right-0 z-[9999]
        bg-slate-800 rounded-xl shadow-2xl border border-slate-600/50
        backdrop-blur-xl w-64 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <span className="text-xs font-semibold text-slate-200 tracking-wide">Settings</span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* Auto-refresh toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-200">Auto-refresh windows</div>
            <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
              Sync changes across windows automatically
            </div>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`
              relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ml-3
              ${autoRefresh ? "bg-emerald-500" : "bg-slate-600"}
            `}
          >
            <div
              className={`
                absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                ${autoRefresh ? "translate-x-4" : "translate-x-0.5"}
              `}
            />
          </button>
        </div>

        {/* Hint text */}
        <div className="text-[9px] text-slate-500 leading-tight">
          {autoRefresh
            ? "Changes made in one window refresh other windows after 300ms."
            : "Use the Refresh button in the inventory bar to sync windows manually."}
        </div>
      </div>
    </div>
  );
}
