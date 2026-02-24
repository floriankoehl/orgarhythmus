import { useState, useMemo } from "react";
import { Merge, ArrowRight, X } from "lucide-react";

/**
 * Modal for choosing which idea to merge *into* when auto-merge is off.
 *
 * Shows the list of selected ideas and lets the user pick the target
 * (the idea that survives). All other ideas become sources whose
 * headline+description are appended to the target.
 *
 * Props:
 *   selectedIdeas  – array of { placement_id, idea_id, title, headline, order_index }
 *   onMerge        – (targetIdeaId, sourceIdeaIds) => void
 *   onCancel       – () => void
 *   autoMerge      – boolean (current setting)
 *   setAutoMerge   – (val) => void
 */
export default function IdeaBinMergeModal({
  selectedIdeas,
  onMerge,
  onCancel,
  autoMerge,
  setAutoMerge,
}) {
  // Pre-select the idea with the highest order_index as the target
  const defaultTargetId = useMemo(() => {
    if (!selectedIdeas.length) return null;
    return selectedIdeas.reduce((best, cur) =>
      cur.order_index > best.order_index ? cur : best
    ).idea_id;
  }, [selectedIdeas]);

  const [targetId, setTargetId] = useState(defaultTargetId);

  const handleMerge = () => {
    if (!targetId) return;
    const sourceIds = selectedIdeas
      .filter(i => i.idea_id !== targetId)
      .map(i => i.idea_id);
    onMerge(targetId, sourceIds);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 z-[9998] rounded-b-lg" onClick={onCancel} />

      {/* Modal */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-[9999] overflow-hidden"
        style={{ width: "min(420px, 92%)", maxHeight: "70%" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <Merge size={14} /> Merge Ideas
          </span>
          <button onClick={onCancel} className="text-white/80 hover:text-white">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 overflow-y-auto" style={{ maxHeight: "calc(70vh - 110px)" }}>
          <p className="text-xs text-gray-500 mb-3">
            Choose the <strong>target idea</strong> — all other ideas will be merged into it.
            Their headlines and descriptions will be appended.
          </p>

          <div className="space-y-1.5">
            {selectedIdeas.map(idea => {
              const isTarget = idea.idea_id === targetId;
              return (
                <button
                  key={idea.idea_id}
                  onClick={() => setTargetId(idea.idea_id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-xs flex items-center gap-2 ${
                    isTarget
                      ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  {/* Radio indicator */}
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    isTarget ? "border-indigo-500" : "border-gray-300"
                  }`}>
                    {isTarget && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                  </span>

                  {/* Content */}
                  <span className="flex-1 min-w-0">
                    <span className={`font-medium truncate block ${isTarget ? "text-indigo-700" : "text-gray-700"}`}>
                      {idea.title || "(untitled)"}
                    </span>
                  </span>

                  {/* Arrow indicator for target */}
                  {isTarget && (
                    <span className="flex items-center gap-0.5 text-[9px] text-indigo-500 font-semibold flex-shrink-0">
                      <ArrowRight size={10} /> TARGET
                    </span>
                  )}
                  {!isTarget && (
                    <span className="text-[9px] text-gray-400 flex-shrink-0">source</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Auto-merge setting */}
          <label className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 cursor-pointer">
            <input
              type="checkbox"
              checked={autoMerge}
              onChange={e => setAutoMerge(e.target.checked)}
              className="accent-indigo-500"
            />
            <span className="text-[10px] text-gray-500">
              Auto-merge by default (higher order index = target, skip this dialog)
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={!targetId}
            className="px-3 py-1.5 rounded text-white text-xs bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Merge size={11} />
            Merge {selectedIdeas.length - 1} idea{selectedIdeas.length > 2 ? "s" : ""} into target
          </button>
        </div>
      </div>
    </>
  );
}
