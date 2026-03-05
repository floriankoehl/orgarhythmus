import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Check, X, ChevronRight, ChevronDown, ChevronLeft,
  Loader, ArrowUpFromLine, CheckCheck, XCircle,
  LayoutList, ArrowRight, ArrowLeft, AlertTriangle,
} from "lucide-react";
import {
  buildChangeItems as _ideabinBuildChangeItems,
  recomposeDetected as _ideabinRecomposeDetected,
  CHANGE_TYPE_META as _IDEABIN_CHANGE_TYPE_META,
} from "./changeBuilder";
import { applyDetected as _ideabinApplyDetected } from "./responseApplier";

/**
 * ═══════════════════════════════════════════════════════════
 *  ControlledApplyModal
 *  ────────────────────
 *  Full-screen modal for reviewing AI-proposed changes.
 *
 *  Two modes:
 *    1. **Slide mode** (default) – one change at a time,
 *       richly detailed, accept/decline per slide.
 *    2. **Overview mode** – grouped checklist of all changes,
 *       Accept All / Decline All, per-group controls.
 *
 *  The user can switch freely between modes at any time.
 *
 *  Props:
 *    detected                – Array from detect*ResponseContent()
 *    applyCtx                – API context from the host window
 *    onResult                – (result) => void
 *    onClose                 – () => void
 *    buildChangeItemsFn      – optional override (task domain)
 *    recomposeDetectedFn     – optional override (task domain)
 *    applyDetectedFn         – optional override (task domain)
 *    changeTypeMeta          – optional override (task domain)
 *    onResolve               – optional (changeItem) => void — for conflict resolution workflow
 *    paused                  – optional boolean — hides panel UI but preserves state
 * ═══════════════════════════════════════════════════════════
 */
export default function ControlledApplyModal({
  detected, applyCtx, onResult, onClose,
  buildChangeItemsFn,
  recomposeDetectedFn,
  applyDetectedFn,
  changeTypeMeta,
  onResolve,
  paused,
  initialSlideIdx,
  depReview,
  onSlideSync,
}) {
  // Domain-aware: use overrides if provided, else default to IdeaBin
  const buildChangeItems   = buildChangeItemsFn   || _ideabinBuildChangeItems;
  const recomposeDetected  = recomposeDetectedFn  || _ideabinRecomposeDetected;
  const applyDetected      = applyDetectedFn      || _ideabinApplyDetected;
  const CHANGE_TYPE_META   = changeTypeMeta
    ? { ..._IDEABIN_CHANGE_TYPE_META, ...changeTypeMeta }
    : _IDEABIN_CHANGE_TYPE_META;

  // ─── State ────────────────────────────────────────────
  const [changeItems, setChangeItems] = useState(() => buildChangeItems(detected));
  const [viewMode, setViewMode] = useState("slide");   // "slide" | "overview"
  const [slideIdx, setSlideIdx] = useState(initialSlideIdx ?? 0);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [applying, setApplying] = useState(false);

  // ─── Refresh conflict status when returning from resolve mode ───
  const prevPausedRef = useRef(paused);
  useEffect(() => {
    const wasPaused = prevPausedRef.current;
    prevPausedRef.current = paused;
    // When transitioning from paused → unpaused, rebuild items to refresh conflicts
    if (wasPaused && !paused) {
      setChangeItems(prev => {
        const fresh = buildChangeItems(detected);
        // Build lookup: old id → old item (to preserve accepted state + detect resolved conflicts)
        const oldMap = new Map(prev.map(ci => [ci.id, ci]));
        return fresh.map(ci => {
          const old = oldMap.get(ci.id);
          if (!old) return ci;
          // Preserve user's accept/decline choice
          const merged = { ...ci, accepted: old.accepted };
          // If item WAS a conflict but now isn't, mark as freshly resolved
          if (old.changeType === "conflict_dependency" && ci.changeType === "create_dependency") {
            merged._resolved = true;
          }
          return merged;
        });
      });
    }
  }, [paused, buildChangeItems, detected]);

  // ─── Sync slide state back to host (e.g. ReviewBar) ──
  useEffect(() => {
    if (onSlideSync) onSlideSync({ slideIdx, changeItems });
  }, [slideIdx, changeItems, onSlideSync]);

  // ─── Derived ──────────────────────────────────────────

  const declinedParents = useMemo(() => {
    const set = new Set();
    for (const ci of changeItems) {
      if (ci.parentId === null && !ci.accepted) set.add(ci.id);
    }
    return set;
  }, [changeItems]);

  const isDisabled = useCallback((ci) =>
    ci.parentId !== null && declinedParents.has(ci.parentId),
  [declinedParents]);

  const totalCount    = changeItems.length;
  const acceptedCount = changeItems.filter(ci => ci.accepted && !isDisabled(ci)).length;
  // In depReview mode, Apply only counts non-conflict items
  const applyableCount = depReview
    ? changeItems.filter(ci => ci.accepted && !isDisabled(ci) && ci.changeType !== "conflict_dependency").length
    : acceptedCount;

  // Flat list of root items for slide navigation
  // (children are shown on the parent's slide)
  const slideItems = useMemo(() => {
    const roots = [];
    for (const ci of changeItems) {
      if (ci.depth === 0) {
        const children = changeItems.filter(c => c.parentId === ci.id);
        roots.push({ ...ci, children });
      }
    }
    return roots;
  }, [changeItems]);

  const currentSlide = slideItems[slideIdx] || null;

  const analysisItems = useMemo(() =>
    detected.filter(d => d.type === "analysis_text" || d.type === "suggestions"),
  [detected]);

  // Ordered groups for overview
  const groups = useMemo(() => {
    const map = new Map();
    for (const ci of changeItems) {
      if (!map.has(ci.group)) map.set(ci.group, { items: [], sortOrder: ci._sortOrder });
      map.get(ci.group).items.push(ci);
    }
    return [...map.entries()]
      .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
      .map(([name, { items }]) => [name, items]);
  }, [changeItems]);

  // ─── Toggle handlers ─────────────────────────────────

  const toggleItem = useCallback((id) => {
    setChangeItems(prev => {
      const idx = prev.findIndex(ci => ci.id === id);
      if (idx === -1) return prev;

      const item = prev[idx];
      const next = [...prev];
      const newAccepted = !item.accepted;
      next[idx] = { ...item, accepted: newAccepted };

      // Propagate to children
      if (!item.parentId) {
        for (let i = 0; i < next.length; i++) {
          if (next[i].parentId === id) {
            next[i] = { ...next[i], accepted: newAccepted };
          }
        }
      }
      return next;
    });
  }, []);

  const acceptAll = useCallback(() => {
    setChangeItems(prev => prev.map(ci => ({ ...ci, accepted: true })));
  }, []);

  const declineAll = useCallback(() => {
    setChangeItems(prev => prev.map(ci => ({ ...ci, accepted: false })));
  }, []);

  const toggleGroup = useCallback((g) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }, []);

  const acceptGroup = useCallback((g) => {
    setChangeItems(prev => prev.map(ci => ci.group === g ? { ...ci, accepted: true } : ci));
  }, []);

  const declineGroup = useCallback((g) => {
    setChangeItems(prev => prev.map(ci => ci.group === g ? { ...ci, accepted: false } : ci));
  }, []);

  // Slide navigation
  const goNext = useCallback(() => {
    setSlideIdx(i => Math.min(i + 1, slideItems.length - 1));
  }, [slideItems.length]);

  const goPrev = useCallback(() => {
    setSlideIdx(i => Math.max(i - 1, 0));
  }, []);

  // ─── Apply ────────────────────────────────────────────

  const handleApply = useCallback(async () => {
    setApplying(true);
    try {
      let effective = changeItems.map(ci =>
        isDisabled(ci) ? { ...ci, accepted: false } : ci,
      );
      // In depReview mode, exclude conflict items from apply
      if (depReview) {
        effective = effective.map(ci =>
          ci.changeType === "conflict_dependency" ? { ...ci, accepted: false } : ci,
        );
      }
      const filtered = recomposeDetected(detected, effective);
      const result = await applyDetected(filtered, applyCtx);
      onResult(result);
    } catch (e) {
      onResult({ created: [], errors: [e.message || "Unknown error"] });
    } finally {
      setApplying(false);
    }
  }, [changeItems, detected, applyCtx, onResult, isDisabled, depReview]);

  // ─── Render ───────────────────────────────────────────

  // When paused (resolve mode), hide the backdrop + modal but stay mounted
  if (paused) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-[10001] bg-white rounded-xl shadow-2xl flex flex-col"
        style={{
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, 92vw)",
          maxHeight: "min(680px, 88vh)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-gray-900">Review AI Changes</span>
            <span className="text-[10px] text-gray-500 tabular-nums">
              {acceptedCount}/{totalCount} accepted
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <button
              onClick={() => setViewMode(v => v === "slide" ? "overview" : "slide")}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              title={viewMode === "slide" ? "Show overview" : "Show slide view"}
            >
              <LayoutList size={11} />
              {viewMode === "slide" ? "Overview" : "Slide View"}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === "slide" ? (
            <SlideView
              slideItems={slideItems}
              slideIdx={slideIdx}
              changeItems={changeItems}
              onToggle={toggleItem}
              onPrev={goPrev}
              onNext={goNext}
              isDisabled={isDisabled}
              analysisItems={analysisItems}
              changeTypeMeta={CHANGE_TYPE_META}
              onResolve={onResolve}
              depReview={depReview}
            />
          ) : (
            <OverviewView
              groups={groups}
              changeItems={changeItems}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              onToggleItem={toggleItem}
              onAcceptAll={acceptAll}
              onDeclineAll={declineAll}
              onAcceptGroup={acceptGroup}
              onDeclineGroup={declineGroup}
              isDisabled={isDisabled}
              analysisItems={analysisItems}
              changeTypeMeta={CHANGE_TYPE_META}
              depReview={depReview}
            />
          )}
        </div>

        {/* ── Footer ── */}
        {/* In depReview + slide mode: no Apply button (accept/decline happens in ReviewBar) */}
        {!(depReview && viewMode === "slide") && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200">
            <button
              onClick={onClose}
              className="text-[11px] px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <div className="flex-1" />
            {applyableCount > 0 ? (
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex items-center gap-1.5 text-[11px] px-4 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 font-medium transition-colors"
              >
                {applying ? (
                  <><Loader size={12} className="animate-spin" /> Applying…</>
                ) : (
                  <><ArrowUpFromLine size={12} /> Apply {applyableCount} Change{applyableCount > 1 ? "s" : ""}</>
                )}
              </button>
            ) : (
              <span className="text-[11px] text-gray-400 italic">No changes accepted</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════
//  SLIDE VIEW
// ═══════════════════════════════════════════════════════════

function SlideView({ slideItems, slideIdx, changeItems, onToggle, onPrev, onNext, isDisabled, analysisItems, changeTypeMeta, onResolve, depReview }) {
  const CHANGE_TYPE_META = changeTypeMeta;
  const current = slideItems[slideIdx];
  if (!current && analysisItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[11px] text-gray-400 italic">
        No actionable changes detected.
      </div>
    );
  }

  if (!current) {
    return (
      <div className="px-5 py-4">
        {analysisItems.map((item, i) => <AnalysisBlock key={i} item={item} />)}
      </div>
    );
  }

  const meta = CHANGE_TYPE_META[current.changeType] || { dotColor: "bg-gray-400", verb: "Change" };
  const isOff = !current.accepted;
  const total = slideItems.length;

  return (
    <div className="flex flex-col h-full">
      {/* Navigation bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
        <button
          onClick={onPrev}
          disabled={slideIdx === 0}
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={12} /> Previous
        </button>
        <span className="text-[10px] font-medium text-gray-600 tabular-nums">
          {slideIdx + 1} / {total}
        </span>
        <button
          onClick={onNext}
          disabled={slideIdx >= total - 1}
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight size={12} />
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 px-5 py-4 overflow-y-auto">
        {/* Group badge — hidden in depReview mode */}
        {!depReview && (
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              {current.group}
            </span>
          </div>
        )}

        {/* Detail card */}
        <SlideDetailCard detail={current.detail} changeType={current.changeType} resolved={current._resolved} />

        {/* Children (if any) */}
        {current.children?.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] font-semibold text-gray-600 mb-2">
              Includes {current.children.length} dependent change{current.children.length > 1 ? "s" : ""}:
            </div>
            <div className="bg-gray-50 rounded border border-gray-200 divide-y divide-gray-100">
              {current.children.map(child => (
                <ChangeRow
                  key={child.id}
                  item={child}
                  disabled={isDisabled(child)}
                  onToggle={onToggle}
                  compact
                  changeTypeMeta={CHANGE_TYPE_META}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Accept / Decline bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
        <button
          onClick={() => { onToggle(current.id); onNext(); }}
          className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 rounded font-medium transition-colors ${
            isOff
              ? "bg-red-50 border border-red-200 text-red-600"
              : "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
          }`}
        >
          <XCircle size={12} /> {isOff ? "Declined" : "Decline"}
        </button>
        {/* Resolve button — for conflict items or freshly resolved items */}
        {onResolve && (current.changeType === "conflict_dependency" || current._resolved) && (
          current.conflict
            ? (
              <button
                onClick={() => onResolve(current)}
                className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 rounded font-medium transition-colors bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100"
              >
                <AlertTriangle size={12} /> Resolve
              </button>
            ) : (
              <div className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 rounded font-medium bg-green-50 border border-green-200 text-green-700">
                <Check size={12} /> Resolved
              </div>
            )
        )}
        <button
          onClick={() => {
            if (isOff) onToggle(current.id);
            onNext();
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 rounded font-medium transition-colors ${
            !isOff
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100"
          }`}
        >
          <Check size={12} /> {!isOff ? "Accepted" : "Accept"}
        </button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  SLIDE DETAIL CARD — rich before/after views per type
// ═══════════════════════════════════════════════════════════

function SlideDetailCard({ detail, changeType, resolved }) {
  if (!detail) return null;

  /** Render a milestone name colored by team with team/task subtitle */
  const NodeInfo = ({ name, ctx, fallbackColor }) => (
    <div className="flex flex-col">
      <span className="font-medium text-[11px]" style={ctx?.teamColor ? { color: ctx.teamColor } : undefined}>
        {name}
      </span>
      {(ctx?.teamName || ctx?.taskName) && (
        <span className="text-[8px] text-gray-400 leading-tight mt-0.5">
          {[ctx.teamName && `Team: ${ctx.teamName}`, ctx.taskName && `Task: ${ctx.taskName}`].filter(Boolean).join(" · ")}
        </span>
      )}
    </div>
  );

  switch (detail.type) {

    // ── Merge ideas: show originals + merged result ──
    case "merge_ideas": {
      return (
        <div className="flex flex-col gap-3">
          {/* Originals */}
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Original Ideas
            </div>
            <div className="flex flex-col gap-2">
              {detail.originals.map((orig, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded px-3 py-2">
                  <div className="text-[11px] font-medium text-red-800">{orig.title || `Idea ${i + 1}`}</div>
                  {orig.description && (
                    <div className="text-[10px] text-red-600 mt-0.5 whitespace-pre-wrap">{orig.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-1 text-[9px] text-gray-400 font-medium uppercase tracking-wider">
              <ArrowRight size={10} />
              Merged into
              <ArrowRight size={10} />
            </div>
          </div>

          {/* Merged result */}
          <div className="bg-green-50 border border-green-200 rounded px-3 py-2">
            <div className="text-[11px] font-medium text-green-800">{detail.merged.title}</div>
            {detail.merged.description && (
              <div className="text-[10px] text-green-700 mt-0.5 whitespace-pre-wrap">{detail.merged.description}</div>
            )}
          </div>

          {/* Reason */}
          {detail.reason && (
            <div className="text-[9px] text-gray-500 italic px-1">
              Reason: {detail.reason}
            </div>
          )}
        </div>
      );
    }

    // ── Update idea: show before → after ──
    case "update_idea": {
      return (
        <div className="flex flex-col gap-3">
          {detail.inCategory && (
            <div className="text-[10px] text-gray-500">
              In category: <span className="font-medium text-gray-700">{detail.inCategory}</span>
            </div>
          )}

          {/* Title change */}
          {detail.titleChanged ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Title</div>
              <div className="flex flex-col gap-1">
                <div className="bg-red-50 border border-red-200 rounded px-3 py-1.5">
                  <div className="text-[10px] text-red-400 mb-0.5">Before</div>
                  <div className="text-[11px] text-red-800 line-through">{detail.originalTitle}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded px-3 py-1.5">
                  <div className="text-[10px] text-green-500 mb-0.5">After</div>
                  <div className="text-[11px] text-green-800 font-medium">{detail.newTitle}</div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Title</div>
              <div className="text-[11px] text-gray-800">{detail.originalTitle}</div>
            </div>
          )}

          {/* Description */}
          {detail.newDescription != null && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                New Description
              </div>
              <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-[10px] text-green-800 whitespace-pre-wrap">
                {detail.newDescription || "(empty)"}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── Rename category ──
    case "rename_category": {
      return (
        <div className="flex flex-col gap-3">
          {detail.renamed ? (
            <>
              <div className="flex flex-col gap-1">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Category Name</div>
                <div className="bg-red-50 border border-red-200 rounded px-3 py-1.5">
                  <div className="text-[10px] text-red-400 mb-0.5">Before</div>
                  <div className="text-[11px] text-red-800 line-through">{detail.originalName}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded px-3 py-1.5">
                  <div className="text-[10px] text-green-500 mb-0.5">After</div>
                  <div className="text-[11px] text-green-800 font-medium">{detail.newName}</div>
                </div>
              </div>
              {detail.ideaUpdateCount > 0 && (
                <div className="text-[10px] text-gray-500">
                  + {detail.ideaUpdateCount} idea update{detail.ideaUpdateCount > 1 ? "s" : ""} inside
                </div>
              )}
            </>
          ) : (
            <div className="text-[11px] text-gray-700">
              Category "{detail.originalName}" — {detail.ideaUpdateCount} idea update{detail.ideaUpdateCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      );
    }

    // ── Create idea ──
    case "create_idea": {
      return (
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">New Idea</div>
            <div className="bg-green-50 border border-green-200 rounded px-3 py-2">
              <div className="text-[12px] font-medium text-green-800">{detail.title}</div>
              {detail.description && (
                <div className="text-[10px] text-green-700 mt-1 whitespace-pre-wrap">{detail.description}</div>
              )}
            </div>
          </div>
          <div className="text-[10px] text-gray-500">
            Target: <span className="font-medium text-gray-700">{detail.target}</span>
          </div>
          {detail.gapArea && (
            <div className="text-[10px] text-gray-500">
              Gap area: <span className="font-medium text-gray-700">{detail.gapArea}</span>
            </div>
          )}
        </div>
      );
    }

    // ── Create category ──
    case "create_category": {
      return (
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              New {detail.isTeam ? "Team-Category" : "Category"}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2">
              <div className="text-[12px] font-medium text-blue-800">{detail.categoryName}</div>
              {detail.ideaCount > 0 && (
                <div className="text-[10px] text-blue-600 mt-1">
                  {detail.isAssignment ? "Moving" : "With"} {detail.ideaCount} idea{detail.ideaCount > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
          {detail.ideaNames?.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Ideas</div>
              <div className="flex flex-col gap-0.5">
                {detail.ideaNames.map((name, i) => (
                  <div key={i} className="text-[10px] text-gray-700 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── Move idea ──
    case "move_idea": {
      return (
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Move Idea</div>
            <div className="bg-teal-50 border border-teal-200 rounded px-3 py-2">
              <div className="text-[11px] font-medium text-teal-800">{detail.ideaTitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <ArrowRight size={10} />
            To category: <span className="font-medium text-gray-700">{detail.targetCategory}</span>
          </div>
        </div>
      );
    }

    // ── Assign legend type ──
    case "assign_legend": {
      return (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-gray-500">
            Assign legend type to idea
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded px-3 py-2 space-y-1">
            <div className="text-[10px] text-purple-500">Idea</div>
            <div className="text-[11px] font-medium text-purple-800">{detail.ideaTitle}</div>
            <div className="text-[10px] text-purple-500 mt-1.5">Legend</div>
            <div className="text-[11px] text-purple-700">{detail.legendName}</div>
            <div className="text-[10px] text-purple-500 mt-1.5">Type</div>
            <div className="text-[11px] font-medium text-purple-800">{detail.typeName}</div>
          </div>
        </div>
      );
    }

    // ── Create legend ──
    case "create_legend": {
      return (
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">New Legend</div>
            <div className="bg-purple-50 border border-purple-200 rounded px-3 py-2">
              <div className="text-[12px] font-medium text-purple-800">{detail.legendName}</div>
              {detail.typeNames?.length > 0 && (
                <div className="text-[10px] text-purple-600 mt-1">
                  Types: {detail.typeNames.join(", ")}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // ── Create legend type ──
    case "create_legend_type": {
      return (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-gray-500">
            Add type to legend "{detail.legendName}"
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded px-3 py-2 flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 border border-purple-300"
              style={{ backgroundColor: detail.color }}
            />
            <div className="text-[11px] font-medium text-purple-800">{detail.typeName}</div>
          </div>
        </div>
      );
    }

    // ── Create filter preset ──
    case "create_filter_preset": {
      return (
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">New Filter Preset</div>
            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
              <div className="text-[11px] font-medium text-gray-800">{detail.presetName}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                {detail.rules.length} rule{detail.rules.length !== 1 ? "s" : ""} · Combine: {detail.combineMode}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ════════════════════════════════════════════════════
    //  TASK DOMAIN — detail types
    // ════════════════════════════════════════════════════

    // ── Create task ──
    case "create_task": {
      return (
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">New Task</div>
            <div className="bg-green-50 border border-green-200 rounded px-3 py-2">
              <div className="text-[12px] font-medium text-green-800">{detail.name}</div>
              {detail.description && (
                <div className="text-[10px] text-green-700 mt-1 whitespace-pre-wrap">{detail.description}</div>
              )}
              {(detail.priority || detail.difficulty) && (
                <div className="flex items-center gap-2 mt-1.5">
                  {detail.priority && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                      Priority: {detail.priority}
                    </span>
                  )}
                  {detail.difficulty && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                      Difficulty: {detail.difficulty}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="text-[10px] text-gray-500">
            Target: <span className="font-medium text-gray-700">{detail.target || "Unassigned"}</span>
          </div>
          {detail.criteriaCount > 0 && (
            <div className="text-[10px] text-gray-500">
              Includes {detail.criteriaCount} acceptance criteri{detail.criteriaCount === 1 ? "on" : "a"}
            </div>
          )}
        </div>
      );
    }

    // ── Create team ──
    case "create_team": {
      return (
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              New Team{detail.isAssignment ? " + Assign Tasks" : ""}
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded px-3 py-2 flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 border border-indigo-300"
                style={{ backgroundColor: detail.color || "#6366f1" }}
              />
              <div className="text-[12px] font-medium text-indigo-800">{detail.teamName}</div>
              {detail.taskCount > 0 && (
                <span className="text-[10px] text-indigo-600 ml-auto">
                  {detail.taskCount} task{detail.taskCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          {detail.taskNames?.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Tasks</div>
              <div className="flex flex-col gap-0.5">
                {detail.taskNames.map((name, i) => (
                  <div key={i} className="text-[10px] text-gray-700 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── Update task ──
    case "update_task": {
      return (
        <div className="flex flex-col gap-3">
          {/* Title change */}
          {detail.renamed ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Task Name</div>
              <div className="flex flex-col gap-1">
                <div className="bg-red-50 border border-red-200 rounded px-3 py-1.5">
                  <div className="text-[10px] text-red-400 mb-0.5">Before</div>
                  <div className="text-[11px] text-red-800 line-through">{detail.originalName}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded px-3 py-1.5">
                  <div className="text-[10px] text-green-500 mb-0.5">After</div>
                  <div className="text-[11px] text-green-800 font-medium">{detail.newName}</div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Task</div>
              <div className="text-[11px] text-gray-800">{detail.originalName}</div>
            </div>
          )}
          {detail.description != null && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">New Description</div>
              <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-[10px] text-green-800 whitespace-pre-wrap">
                {detail.description || "(empty)"}
              </div>
            </div>
          )}
          {(detail.priority || detail.difficulty) && (
            <div className="flex items-center gap-2">
              {detail.priority && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                  Priority → {detail.priority}
                </span>
              )}
              {detail.difficulty && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                  Difficulty → {detail.difficulty}
                </span>
              )}
            </div>
          )}
          {detail.criteriaCount > 0 && (
            <div className="text-[10px] text-gray-500">
              + {detail.criteriaCount} acceptance criteri{detail.criteriaCount === 1 ? "on" : "a"}
            </div>
          )}
        </div>
      );
    }

    // ── Update team ──
    case "update_team": {
      return (
        <div className="flex flex-col gap-3">
          {detail.renamed ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Team Name</div>
              <div className="flex flex-col gap-1">
                <div className="bg-red-50 border border-red-200 rounded px-3 py-1.5">
                  <div className="text-[10px] text-red-400 mb-0.5">Before</div>
                  <div className="text-[11px] text-red-800 line-through">{detail.originalName}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded px-3 py-1.5">
                  <div className="text-[10px] text-green-500 mb-0.5">After</div>
                  <div className="text-[11px] text-green-800 font-medium">{detail.newName}</div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Team</div>
              <div className="text-[11px] text-gray-800">{detail.originalName}</div>
            </div>
          )}
          {detail.color && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">Color:</span>
              <span
                className="w-4 h-4 rounded border border-gray-300"
                style={{ backgroundColor: detail.color }}
              />
              <span className="text-[10px] text-gray-600 font-mono">{detail.color}</span>
            </div>
          )}
        </div>
      );
    }

    // ── Move / assign task ──
    case "move_task": {
      return (
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Assign Task</div>
            <div className="bg-teal-50 border border-teal-200 rounded px-3 py-2">
              <div className="text-[11px] font-medium text-teal-800">{detail.taskName}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <ArrowRight size={10} />
            To team: <span className="font-medium text-gray-700">{detail.targetTeam}</span>
          </div>
        </div>
      );
    }

    // ── Add acceptance criteria ──
    case "add_criteria": {
      return (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-gray-500">
            Add criterion to task: <span className="font-medium text-gray-700">{detail.taskName}</span>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded px-3 py-2">
            <div className="text-[11px] font-medium text-purple-800">{detail.criterionTitle}</div>
          </div>
        </div>
      );
    }

    // ════════════════════════════════════════════════════
    //  DEPENDENCY DOMAIN — detail types
    // ════════════════════════════════════════════════════

    // ── Create milestone ──
    case "create_milestone": {
      return (
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">New Milestone</div>
            <div className="bg-green-50 border border-green-200 rounded px-3 py-2">
              <div className="text-[12px] font-medium text-green-800">{detail.name}</div>
              {detail.description && (
                <div className="text-[10px] text-green-700 mt-1 whitespace-pre-wrap">{detail.description}</div>
              )}
              {(detail.startIndex != null || detail.duration) && (
                <div className="flex items-center gap-2 mt-1.5">
                  {detail.startIndex != null && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                      Day: {detail.startIndex}
                    </span>
                  )}
                  {detail.duration && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                      Duration: {detail.duration}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {detail.taskName && (
            <div className="text-[10px] text-gray-500">
              Task: <span className="font-medium text-gray-700">{detail.taskName}</span>
            </div>
          )}
        </div>
      );
    }

    // ── Update milestone ──
    case "update_milestone": {
      return (
        <div className="flex flex-col gap-3">
          {detail.newName ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Milestone Name</div>
              <div className="flex flex-col gap-1">
                <div className="bg-red-50 border border-red-200 rounded px-3 py-1.5">
                  <div className="text-[10px] text-red-400 mb-0.5">Before</div>
                  <div className="text-[11px] text-red-800 line-through">{detail.originalName}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded px-3 py-1.5">
                  <div className="text-[10px] text-green-500 mb-0.5">After</div>
                  <div className="text-[11px] text-green-800 font-medium">{detail.newName}</div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Milestone</div>
              <div className="text-[11px] text-gray-800">{detail.originalName}</div>
            </div>
          )}
          {(detail.startIndex != null || detail.duration != null) && (
            <div className="flex items-center gap-2">
              {detail.startIndex != null && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                  Day → {detail.startIndex}
                </span>
              )}
              {detail.duration != null && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                  Duration → {detail.duration}
                </span>
              )}
            </div>
          )}
        </div>
      );
    }

    // ── Create dependency ──
    case "create_dependency":
    // ── Conflict dependency ──
    case "conflict_dependency":
    // ── Update dependency ──
    case "update_dependency":
    // ── Remove dependency ──
    case "remove_dependency": {
      return <DepEdgeCard detail={detail} changeType={changeType} resolved={resolved} />;
    }

    // ── Move milestone ──
    case "move_milestone": {
      return (
        <div className="flex flex-col gap-2">
          <div className="bg-teal-50 border border-teal-200 rounded px-3 py-2">
            <div className="text-[11px] font-medium text-teal-800">{detail.milestoneName}</div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <ArrowRight size={10} />
            Day {detail.currentDay} → Day {detail.newDay}
            {detail.duration && <span className="text-gray-400 ml-1">(duration: {detail.duration})</span>}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}


// ═══════════════════════════════════════════════════════════
//  DEP EDGE CARD — grid-matching visual for dependency changes
// ═══════════════════════════════════════════════════════════

const WEIGHT_DASH = { strong: "4,3", medium: "6,5", weak: "8,8" };

function DepEdgeCard({ detail, changeType, resolved }) {
  const isConflict = changeType === "conflict_dependency";
  const isRemove   = changeType === "remove_dependency";
  const isUpdate   = changeType === "update_dependency";

  const srcColor = detail.sourceCtx?.teamColor || "#6b7280";
  const tgtColor = detail.targetCtx?.teamColor || "#6b7280";

  // Arrow stroke color per type
  const strokeColor = isConflict ? "#f97316" : isRemove ? "#ef4444" : resolved ? "#22c55e" : "#6b7280";
  const weight = detail.weight || "strong";
  const dash = WEIGHT_DASH[weight] || WEIGHT_DASH.strong;
  // Stroke width varies by weight
  const strokeWidth = weight === "strong" ? 2.5 : weight === "medium" ? 2 : 1.5;

  return (
    <div className="flex flex-col gap-3">
      {/* Conflict badge */}
      {isConflict && (
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-orange-600 uppercase tracking-wider">
          <AlertTriangle size={10} /> Scheduling Conflict
        </div>
      )}
      {resolved && (
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-green-600 uppercase tracking-wider">
          <Check size={10} /> Resolved
        </div>
      )}

      {/* Visual: source → animated path → target */}
      <div className="flex items-center gap-0">
        {/* Source milestone block */}
        <div
          className="rounded-md px-3 py-2 min-w-0 flex-shrink-0"
          style={{
            backgroundColor: srcColor + "18",
            borderLeft: `3px solid ${srcColor}`,
          }}
        >
          <div className="text-[11px] font-semibold leading-tight" style={{ color: srcColor }}>
            {detail.sourceName}
          </div>
          {detail.sourceCtx?.taskName && (
            <div className="text-[8px] text-gray-400 leading-tight mt-0.5">{detail.sourceCtx.taskName}</div>
          )}
        </div>

        {/* Animated dotted arrow */}
        <svg width="80" height="28" className="flex-shrink-0 mx-0.5" viewBox="0 0 80 28">
          <defs>
            <marker id={`arrow-${changeType}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill={strokeColor} />
            </marker>
          </defs>
          <line
            x1="2" y1="14" x2="68" y2="14"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            markerEnd={`url(#arrow-${changeType})`}
            className={isRemove ? "" : "dep-edge-animate"}
          />
          {/* Weight label */}
          <text x="40" y="8" textAnchor="middle" fill="#9ca3af" fontSize="7" fontWeight="500">
            {weight}
          </text>
        </svg>

        {/* Target milestone block */}
        <div
          className={`rounded-md px-3 py-2 min-w-0 flex-shrink-0 ${isRemove ? "opacity-50" : ""}`}
          style={{
            backgroundColor: tgtColor + "18",
            borderLeft: `3px solid ${tgtColor}`,
          }}
        >
          <div className={`text-[11px] font-semibold leading-tight ${isRemove ? "line-through" : ""}`} style={{ color: tgtColor }}>
            {detail.targetName}
          </div>
          {detail.targetCtx?.taskName && (
            <div className="text-[8px] text-gray-400 leading-tight mt-0.5">{detail.targetCtx.taskName}</div>
          )}
        </div>
      </div>

      {/* Conflict message */}
      {isConflict && detail.conflict && (
        <div className="bg-red-50 border border-red-200 rounded px-2.5 py-1.5 text-[9px] text-red-700 flex items-start gap-1.5">
          <AlertTriangle size={10} className="flex-shrink-0 mt-0.5 text-red-500" />
          <span>{detail.conflict.message}</span>
        </div>
      )}

      {/* Reason */}
      {detail.reason && (
        <div className="text-[11px] font-medium text-gray-700 px-1">{detail.reason}</div>
      )}

      {/* Description */}
      {detail.description && (
        <div className="bg-gray-50 border border-gray-100 rounded px-3 py-2">
          <div className="text-[10px] text-gray-600 leading-relaxed">{detail.description}</div>
        </div>
      )}

      <style>{`
        .dep-edge-animate {
          animation: dashFlow 1.2s linear infinite;
        }
        @keyframes dashFlow {
          to { stroke-dashoffset: -20; }
        }
      `}</style>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  OVERVIEW VIEW
// ═══════════════════════════════════════════════════════════

function OverviewView({
  groups, changeItems, collapsedGroups,
  onToggleGroup, onToggleItem,
  onAcceptAll, onDeclineAll, onAcceptGroup, onDeclineGroup,
  isDisabled, analysisItems, changeTypeMeta, depReview,
}) {
  return (
    <div className="px-4 py-3 flex flex-col gap-3">
      {/* Quick actions — hidden in depReview mode */}
      {!depReview && (
        <div className="flex gap-2">
          <button
            onClick={onAcceptAll}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
          >
            <CheckCheck size={10} /> Accept All
          </button>
          <button
            onClick={onDeclineAll}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <XCircle size={10} /> Decline All
          </button>
        </div>
      )}

      {/* Groups */}
      <div className="bg-gray-50 border border-gray-200 rounded overflow-hidden">
        {groups.map(([groupName, items]) => {
          const collapsed     = collapsedGroups.has(groupName);
          const groupAccepted = items.filter(ci => ci.accepted && !isDisabled(ci)).length;
          const groupTotal    = items.length;

          return (
            <div key={groupName} className="border-b border-gray-100 last:border-b-0">
              {/* Group header */}
              <div className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100/60 select-none">
                <button
                  onClick={() => onToggleGroup(groupName)}
                  className="flex items-center gap-1 flex-1 min-w-0 text-left"
                >
                  {collapsed
                    ? <ChevronRight size={10} className="text-gray-400 flex-shrink-0" />
                    : <ChevronDown  size={10} className="text-gray-400 flex-shrink-0" />}
                  <span className="text-[10px] font-semibold text-gray-700 truncate">{groupName}</span>
                  <span className="text-[9px] text-gray-400 flex-shrink-0">{groupAccepted}/{groupTotal}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onAcceptGroup(groupName); }}
                  className="p-0.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                  title="Accept all in group"
                >
                  <CheckCheck size={10} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeclineGroup(groupName); }}
                  className="p-0.5 rounded hover:bg-red-100 text-red-500 transition-colors"
                  title="Decline all in group"
                >
                  <XCircle size={10} />
                </button>
              </div>

              {!collapsed && items.map(ci => (
                <ChangeRow key={ci.id} item={ci} disabled={isDisabled(ci)} onToggle={onToggleItem} changeTypeMeta={changeTypeMeta} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Analysis */}
      {analysisItems.map((item, i) => <AnalysisBlock key={`analysis-${i}`} item={item} />)}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  Shared sub-components
// ═══════════════════════════════════════════════════════════

function ChangeRow({ item, disabled, onToggle, compact, changeTypeMeta }) {
  const meta = (changeTypeMeta || _IDEABIN_CHANGE_TYPE_META)[item.changeType] || { dotColor: "bg-gray-400" };
  const effectively_off = !item.accepted || disabled;

  return (
    <label
      className={`flex items-start gap-1.5 ${compact ? "px-2 py-1" : "px-2.5 py-1.5"} cursor-pointer transition-colors ${
        disabled
          ? "opacity-35 cursor-not-allowed"
          : effectively_off
            ? "opacity-60 hover:bg-gray-100/50"
            : "hover:bg-white/60"
      }`}
      style={{ paddingLeft: item.depth > 0 && !compact ? "1.75rem" : undefined }}
    >
      <input
        type="checkbox"
        checked={item.accepted}
        disabled={disabled}
        onChange={() => onToggle(item.id)}
        className="mt-[3px] h-3 w-3 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 flex-shrink-0 accent-emerald-600"
      />
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5px] ${meta.dotColor}`} />
      <div className="min-w-0 flex-1">
        <div className={`text-[10px] leading-tight ${effectively_off ? "line-through text-gray-400" : "text-gray-800"}`}>
          {item.label}
        </div>
        {item.sublabel && (
          <div className={`text-[9px] leading-tight ${effectively_off ? "text-gray-300" : "text-gray-500"}`}>
            {item.sublabel}
          </div>
        )}
      </div>
    </label>
  );
}

function AnalysisBlock({ item }) {
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded px-3 py-2">
      {item.label && (
        <div className="text-[9px] font-semibold text-indigo-600 mb-1">{item.label}</div>
      )}
      <pre className="text-[9px] text-indigo-800 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
        {typeof item.data === "string" ? item.data : JSON.stringify(item.data, null, 2)}
      </pre>
    </div>
  );
}
