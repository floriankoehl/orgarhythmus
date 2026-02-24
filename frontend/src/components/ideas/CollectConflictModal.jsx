import { useState, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Modal shown when enabling LIVE on a Collect & Remove category
 * while other LIVE + C&R categories have overlapping ideas.
 *
 * For each conflicting idea, shows the legend‑type assignments that
 * cause it to match multiple C&R filters simultaneously. The user
 * marks which type(s) to REMOVE from the idea so it stops matching
 * the unwanted filter. Once resolved, the trigger category goes live.
 */
export default function CollectConflictModal({
  conflictData, // { triggerCatKey, triggerCatName, overlappingIdeas }
  onResolve,    // ({ triggerCatKey, removals: [{ ideaId, legendId }] }) => void
  onCancel,     // () => void
}) {
  const { triggerCatKey, triggerCatName, overlappingIdeas } = conflictData;

  // Track which types the user has marked for removal:
  // Set of "ideaId|legendId" keys
  const [removals, setRemovals] = useState(new Set());

  const toggleRemoval = useCallback((ideaId, legendId) => {
    const key = `${ideaId}|${legendId}`;
    setRemovals(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleResolve = useCallback(() => {
    const removalList = [];
    for (const key of removals) {
      const [ideaId, legendId] = key.split("|");
      removalList.push({ ideaId: parseInt(ideaId), legendId });
    }
    onResolve({ triggerCatKey, removals: removalList });
  }, [triggerCatKey, removals, onResolve]);

  // Check every idea has at least one type marked for removal
  // so each idea will stop matching at least one filter
  const allResolved = overlappingIdeas.every(({ idea, conflictingTypes }) => {
    // An idea is resolved if at least one of its conflicting types is marked for removal
    return conflictingTypes.some(ct => removals.has(`${idea.idea_id}|${ct.legendId}`));
  });

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[9999]" onClick={onCancel} />

      {/* Modal */}
      <div
        className="fixed z-[10000] bg-white rounded-xl shadow-2xl border border-orange-300 overflow-hidden"
        style={{
          top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: "min(560px, 92vw)", maxHeight: "80vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-600 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-orange-800">Collect & Remove Conflict</h3>
            <p className="text-[11px] text-orange-700 mt-0.5 leading-snug">
              {overlappingIdeas.length} idea{overlappingIdeas.length !== 1 ? "s" : ""} match
              filters in multiple <strong>live C&R</strong> categories.
              Remove the legend type(s) that cause the overlap.
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Scrollable idea list */}
        <div className="overflow-y-auto px-4 py-2" style={{ maxHeight: "55vh", scrollbarWidth: "thin" }}>
          {overlappingIdeas.map(({ idea, conflictingTypes, matchingCats }) => {
            const hasRemoval = conflictingTypes.some(ct => removals.has(`${idea.idea_id}|${ct.legendId}`));
            return (
              <div
                key={idea.idea_id}
                className={`py-2.5 border-b border-gray-100 last:border-0 transition-colors ${hasRemoval ? "bg-green-50/50" : ""}`}
              >
                {/* Idea title */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-gray-800 truncate flex-1">
                    {idea.title}
                  </span>
                  {idea.headline && (
                    <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
                      {idea.headline}
                    </span>
                  )}
                  {hasRemoval && (
                    <span className="text-[9px] text-green-600 font-medium flex-shrink-0">✓ resolved</span>
                  )}
                </div>

                {/* Matching categories hint */}
                <div className="text-[9px] text-gray-400 mb-1.5 pl-0.5">
                  Matches: {matchingCats.map(c => c.catName).join(" · ")}
                </div>

                {/* Conflicting type pills */}
                <div className="flex flex-wrap gap-1.5">
                  {conflictingTypes.map((ct) => {
                    const removalKey = `${idea.idea_id}|${ct.legendId}`;
                    const isMarked = removals.has(removalKey);
                    return (
                      <button
                        key={removalKey}
                        onClick={() => toggleRemoval(idea.idea_id, ct.legendId)}
                        className={`px-2.5 py-1 text-[10px] rounded-lg border transition-all flex items-center gap-1.5 ${
                          isMarked
                            ? "bg-red-100 text-red-700 border-red-400 line-through opacity-70"
                            : "bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:bg-orange-50"
                        }`}
                        title={isMarked ? "Click to keep this type" : "Click to remove this type from the idea"}
                      >
                        {/* Color dot */}
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-200"
                          style={{ backgroundColor: ct.typeColor || "#ccc" }}
                        />
                        <span>{ct.typeName}</span>
                        {/* Show which categories this type causes a match in */}
                        <span className="text-[8px] text-gray-400 ml-0.5">
                          ({ct.causedBy.map(c => c.catName).join(", ")})
                        </span>
                        {isMarked && <X size={9} className="text-red-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <p className="text-[10px] text-gray-500">
            {removals.size === 0
              ? "Select types to remove so each idea matches only one C&R filter."
              : `${removals.size} type${removals.size !== 1 ? "s" : ""} marked for removal.`
            }
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-[11px] rounded border border-gray-300 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={!allResolved}
              className={`px-3 py-1.5 text-[11px] rounded font-medium transition-colors ${
                allResolved
                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Resolve & Go Live
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
