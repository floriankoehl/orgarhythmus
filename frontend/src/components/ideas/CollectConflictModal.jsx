import { useState, useCallback } from "react";
import { AlertTriangle, PackageMinus, Check } from "lucide-react";

/**
 * Modal shown when enabling LIVE on a Collect & Remove category
 * while other LIVE + C&R categories have overlapping ideas.
 *
 * Lets the user choose, for each conflicting idea, which C&R category
 * should "own" it. Ideas are removed from the non-selected categories
 * before going live.
 */
export default function CollectConflictModal({
  conflictData, // { triggerCatKey, triggerCatName, overlappingIdeas }
  ideas,
  onResolve,    // (resolution) => void
  onCancel,     // () => void
}) {
  const { triggerCatKey, triggerCatName, overlappingIdeas } = conflictData;

  // Track user decisions: { [ideaId]: selectedCatKey }
  const [decisions, setDecisions] = useState(() => {
    const init = {};
    for (const item of overlappingIdeas) {
      init[item.idea.idea_id] = item.selectedCatKey;
    }
    return init;
  });

  const setDecision = useCallback((ideaId, catKey) => {
    setDecisions(prev => ({ ...prev, [ideaId]: catKey }));
  }, []);

  // "Assign all to this category" shortcut
  const assignAllTo = useCallback((catKey) => {
    setDecisions(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) next[key] = catKey;
      return next;
    });
  }, []);

  const handleResolve = useCallback(() => {
    onResolve({ triggerCatKey, decisions });
  }, [triggerCatKey, decisions, onResolve]);

  // Gather all unique conflicting category keys/names
  const allCats = [];
  const catSeen = new Set();
  for (const item of overlappingIdeas) {
    for (const mc of item.matchingCats) {
      if (!catSeen.has(mc.catKey)) {
        catSeen.add(mc.catKey);
        allCats.push(mc);
      }
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[9999]" onClick={onCancel} />

      {/* Modal */}
      <div
        className="fixed z-[10000] bg-white rounded-xl shadow-2xl border border-orange-300 overflow-hidden"
        style={{
          top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: "min(520px, 90vw)", maxHeight: "80vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-600 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-orange-800">Collect & Remove Conflict</h3>
            <p className="text-[11px] text-orange-700 mt-0.5 leading-snug">
              {overlappingIdeas.length} idea{overlappingIdeas.length !== 1 ? "s" : ""} match
              filters in multiple <strong>live C&R</strong> categories.
              Choose which category each idea should belong to.
            </p>
          </div>
        </div>

        {/* Quick-assign buttons */}
        {allCats.length > 1 && (
          <div className="px-4 pt-2 pb-1 flex items-center gap-2 text-[10px] text-gray-500 border-b border-gray-100">
            <span className="font-medium">Assign all to:</span>
            {allCats.map(({ catKey, catName }) => (
              <button
                key={catKey}
                onClick={() => assignAllTo(catKey)}
                className="px-2 py-0.5 rounded border border-gray-300 hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-700"
              >
                {catName}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable idea list */}
        <div className="overflow-y-auto px-4 py-2" style={{ maxHeight: "50vh", scrollbarWidth: "thin" }}>
          {overlappingIdeas.map(({ idea, matchingCats }) => (
            <div
              key={idea.idea_id}
              className="py-2 border-b border-gray-100 last:border-0"
            >
              {/* Idea info */}
              <div className="flex items-center gap-2 mb-1.5">
                <PackageMinus size={11} className="text-gray-400 flex-shrink-0" />
                <span className="text-[12px] font-medium text-gray-800 truncate flex-1">
                  {idea.title}
                </span>
                {idea.headline && (
                  <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
                    {idea.headline}
                  </span>
                )}
              </div>

              {/* Category radio buttons */}
              <div className="flex flex-wrap gap-1.5 pl-5">
                {matchingCats.map(({ catKey, catName }) => {
                  const isSelected = String(decisions[idea.idea_id]) === String(catKey);
                  return (
                    <button
                      key={catKey}
                      onClick={() => setDecision(idea.idea_id, catKey)}
                      className={`px-2.5 py-1 text-[10px] rounded-full border transition-all flex items-center gap-1 ${
                        isSelected
                          ? "bg-blue-500 text-white border-blue-500 font-medium shadow-sm"
                          : "bg-white text-gray-600 border-gray-300 hover:border-blue-300 hover:bg-blue-50"
                      }`}
                    >
                      {isSelected && <Check size={9} />}
                      {catName}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <p className="text-[10px] text-gray-500">
            Non-selected placements will be removed before going live.
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
              className="px-3 py-1.5 text-[11px] rounded bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
            >
              Resolve & Go Live
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
