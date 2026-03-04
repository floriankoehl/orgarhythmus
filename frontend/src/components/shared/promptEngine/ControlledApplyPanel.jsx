import React, { useState, useMemo, useCallback } from "react";
import {
  Check, ChevronRight, ChevronDown, ArrowLeft,
  Loader, ArrowUpFromLine, CheckCheck, XCircle,
} from "lucide-react";
import {
  buildChangeItems,
  recomposeDetected,
  CHANGE_TYPE_META,
} from "./changeBuilder";
import { applyDetected } from "./responseApplier";

/**
 * ═══════════════════════════════════════════════════════════
 *  ControlledApplyPanel
 *  ─────────────────────
 *  Replaces the old "preview → apply-all" flow with a
 *  human-in-the-loop review panel where every change can be
 *  individually accepted or declined.
 *
 *  Dependencies are tracked: declining a parent (e.g. a new
 *  category) automatically declines its children (the ideas
 *  inside it).  Re-accepting the parent restores children.
 *
 *  Accepted items are recomposed into a filtered `detected`
 *  array that feeds straight into the existing
 *  `applyDetected()` function — zero duplication of apply
 *  logic.
 *
 *  Props:
 *    detected   – Array from detectResponseContent()
 *    applyCtx   – API context from IdeaBin
 *    onResult   – (result) => void   called with apply outcome
 *    onBack     – () => void         go back to paste mode
 * ═══════════════════════════════════════════════════════════
 */
export default function ControlledApplyPanel({ detected, applyCtx, onResult, onBack }) {
  // ─── State ────────────────────────────────────────────
  const [changeItems, setChangeItems] = useState(() => buildChangeItems(detected));
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [applying, setApplying] = useState(false);

  // ─── Derived ──────────────────────────────────────────

  /** Ordered groups: [ [groupName, items[]], … ] */
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

  /** Set of parent IDs that are currently declined */
  const declinedParents = useMemo(() => {
    const set = new Set();
    for (const ci of changeItems) {
      if (!ci.accepted && !ci.parentId) set.add(ci.id);          // root declined
      if (!ci.accepted && ci.parentId) {
        // check if this item is itself a parent of others
        // (shouldn't happen in current schema but future-proof)
      }
    }
    // Also add parents that are explicitly declined
    for (const ci of changeItems) {
      if (ci.parentId !== null && !ci.accepted) continue;
      if (ci.parentId === null && !ci.accepted) set.add(ci.id);
    }
    return set;
  }, [changeItems]);

  /** Is a child disabled because its parent is declined? */
  const isDisabled = useCallback((ci) => {
    return ci.parentId !== null && declinedParents.has(ci.parentId);
  }, [declinedParents]);

  const totalCount    = changeItems.length;
  const acceptedCount = changeItems.filter(ci =>
    ci.accepted && !isDisabled(ci),
  ).length;

  // Analysis / read-only items from detected (pass-through)
  const analysisItems = useMemo(() =>
    detected.filter(d => d.type === "analysis_text" || d.type === "suggestions"),
  [detected]);

  // ─── Toggle handlers ─────────────────────────────────

  const toggleItem = useCallback((id) => {
    setChangeItems(prev => {
      const idx = prev.findIndex(ci => ci.id === id);
      if (idx === -1) return prev;

      const item = prev[idx];
      const next = [...prev];
      const newAccepted = !item.accepted;
      next[idx] = { ...item, accepted: newAccepted };

      // If this is a parent, propagate to all children
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

  const toggleGroup = useCallback((groupName) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(groupName) ? next.delete(groupName) : next.add(groupName);
      return next;
    });
  }, []);

  const acceptGroup = useCallback((groupName) => {
    setChangeItems(prev =>
      prev.map(ci => ci.group === groupName ? { ...ci, accepted: true } : ci),
    );
  }, []);

  const declineGroup = useCallback((groupName) => {
    setChangeItems(prev =>
      prev.map(ci => ci.group === groupName ? { ...ci, accepted: false } : ci),
    );
  }, []);

  // ─── Apply ────────────────────────────────────────────

  const handleApply = useCallback(async () => {
    setApplying(true);
    try {
      // Filter out disabled children from the accepted list
      const effective = changeItems.map(ci =>
        isDisabled(ci) ? { ...ci, accepted: false } : ci,
      );
      const filtered = recomposeDetected(detected, effective);
      const result = await applyDetected(filtered, applyCtx);
      onResult(result);
    } catch (e) {
      onResult({ created: [], errors: [e.message || "Unknown error"] });
    } finally {
      setApplying(false);
    }
  }, [changeItems, detected, applyCtx, onResult, isDisabled]);

  // ─── Render ───────────────────────────────────────────

  if (changeItems.length === 0 && analysisItems.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-[10px] text-gray-500 italic text-center py-4">
          No actionable changes detected.
        </div>
        {analysisItems.map((item, i) => (
          <AnalysisBlock key={i} item={item} />
        ))}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft size={10} /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* ── Summary bar ── */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-700">
          Review Changes
        </span>
        <span className="text-[9px] text-gray-500 tabular-nums">
          {acceptedCount} / {totalCount} accepted
        </span>
      </div>

      {/* ── Quick actions ── */}
      <div className="flex gap-1.5">
        <button
          onClick={acceptAll}
          className="flex items-center gap-1 text-[9px] px-2 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
        >
          <CheckCheck size={9} /> Accept All
        </button>
        <button
          onClick={declineAll}
          className="flex items-center gap-1 text-[9px] px-2 py-1 rounded border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          <XCircle size={9} /> Decline All
        </button>
      </div>

      {/* ── Change item groups ── */}
      <div className="bg-gray-50 border border-gray-200 rounded overflow-hidden">
        {groups.map(([groupName, items]) => {
          const collapsed      = collapsedGroups.has(groupName);
          const groupAccepted  = items.filter(ci => ci.accepted && !isDisabled(ci)).length;
          const groupTotal     = items.length;

          return (
            <div key={groupName} className="border-b border-gray-100 last:border-b-0">
              {/* Group header */}
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-100/60 select-none">
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="flex items-center gap-1 flex-1 min-w-0 text-left"
                >
                  {collapsed
                    ? <ChevronRight size={10} className="text-gray-400 flex-shrink-0" />
                    : <ChevronDown  size={10} className="text-gray-400 flex-shrink-0" />
                  }
                  <span className="text-[10px] font-semibold text-gray-700 truncate">
                    {groupName}
                  </span>
                  <span className="text-[9px] text-gray-400 flex-shrink-0">
                    {groupAccepted}/{groupTotal}
                  </span>
                </button>

                {/* per-group accept/decline */}
                <button
                  onClick={(e) => { e.stopPropagation(); acceptGroup(groupName); }}
                  className="p-0.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                  title="Accept all in group"
                >
                  <CheckCheck size={10} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); declineGroup(groupName); }}
                  className="p-0.5 rounded hover:bg-red-100 text-red-500 transition-colors"
                  title="Decline all in group"
                >
                  <XCircle size={10} />
                </button>
              </div>

              {/* Items */}
              {!collapsed && items.map(ci => (
                <ChangeRow
                  key={ci.id}
                  item={ci}
                  disabled={isDisabled(ci)}
                  onToggle={toggleItem}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* ── Analysis text (read-only) ── */}
      {analysisItems.map((item, i) => (
        <AnalysisBlock key={`analysis-${i}`} item={item} />
      ))}

      {/* ── Action buttons ── */}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft size={10} /> Back
        </button>
        {acceptedCount > 0 ? (
          <button
            onClick={handleApply}
            disabled={applying}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 font-medium transition-colors"
          >
            {applying ? (
              <><Loader size={10} className="animate-spin" /> Applying…</>
            ) : (
              <><ArrowUpFromLine size={10} /> Apply {acceptedCount} Change{acceptedCount > 1 ? "s" : ""}</>
            )}
          </button>
        ) : (
          <div className="flex-1 text-[10px] text-gray-500 italic flex items-center justify-center">
            No changes accepted
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Sub-components ─────────────────────────────────────

function ChangeRow({ item, disabled, onToggle }) {
  const meta = CHANGE_TYPE_META[item.changeType] || { dotColor: "bg-gray-400" };
  const effectively_off = !item.accepted || disabled;

  return (
    <label
      className={`flex items-start gap-1.5 px-2 py-1 cursor-pointer transition-colors ${
        disabled
          ? "opacity-35 cursor-not-allowed"
          : effectively_off
            ? "opacity-60 hover:bg-gray-100/50"
            : "hover:bg-white/60"
      }`}
      style={{ paddingLeft: item.depth > 0 ? "1.75rem" : undefined }}
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
    <div className="bg-indigo-50 border border-indigo-200 rounded px-2.5 py-2">
      {item.label && (
        <div className="text-[9px] font-semibold text-indigo-600 mb-1">{item.label}</div>
      )}
      <pre className="text-[9px] text-indigo-800 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
        {typeof item.data === "string" ? item.data : JSON.stringify(item.data, null, 2)}
      </pre>
    </div>
  );
}
