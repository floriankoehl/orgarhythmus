// engine3d/components.jsx — Sub-components for the 3D assignment view
// ═══════════════════════════════════════════════════════════════════
//
// Contains: ViewsPanel, ToolbarPlaceholder, DayGrid, MilestoneLayer
// These are display-only components for the 3D Gantt scene.
// No logic changes.
//
import { useState, useMemo } from 'react';
import {
  DEFAULT_TASKHEIGHT_NORMAL,
  DEFAULT_TASKHEIGHT_SMALL,
  TEAM_COLLAPSED_HEIGHT,
  TEAM_PHASE_ROW_HEIGHT,
  getVisibleTasks,
  computeMilestonePixelPositions,
  getContrastTextColor,
} from '../pages/dependency/layoutMath.js';
import {
  DEFAULT_DAYWIDTH,
  HEADER_HEIGHT,
} from '../pages/dependency/layoutMath.js';
import { getTaskHeight, getTaskYOffset, getTeamRowHeight } from './constants.js';

// ══════════════════════════════════════════════════════════════════
// ViewsPanel — floating view switcher outside the 3D scene
// ══════════════════════════════════════════════════════════════════

export function ViewsPanel({
  savedViews, activeViewId, activeViewName,
  handleLoadView, handleNextView, handlePrevView,
  handleSaveView, handleCreateView, handleDeleteView, handleSetDefaultView,
  viewFlashName,
}) {
  const [newViewName, setNewViewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const panelStyle = {
    position: 'absolute', top: '210px', left: '12px', zIndex: 999,
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
    padding: '10px 14px', borderRadius: '10px',
    fontFamily: 'monospace', fontSize: '12px',
    color: '#fff', minWidth: '200px', maxWidth: '260px',
  };

  const btnBase = {
    border: 'none', cursor: 'pointer', borderRadius: '4px',
    fontSize: '11px', padding: '4px 8px', transition: 'background 0.15s',
  };

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Views</span>
        {viewFlashName && (
          <span style={{
            fontSize: '9px', background: '#14b8a6', color: '#fff',
            padding: '2px 6px', borderRadius: '4px', fontWeight: 600,
          }}>
            {viewFlashName.name}
          </span>
        )}
      </div>

      {/* Active view + nav arrows */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
        <button
          onClick={handlePrevView}
          style={{ ...btnBase, background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '4px 6px' }}
          title="Previous view"
        >
          ◀
        </button>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: '12px', fontWeight: 600,
          color: '#5eead4', padding: '4px 0', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {activeViewName || 'Default'}
        </div>
        <button
          onClick={handleNextView}
          style={{ ...btnBase, background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '4px 6px' }}
          title="Next view"
        >
          ▶
        </button>
        {activeViewId && (
          <button
            onClick={handleSaveView}
            style={{ ...btnBase, background: 'rgba(20,184,166,0.3)', color: '#5eead4', padding: '4px 6px' }}
            title="Save current state to this view"
          >
            💾
          </button>
        )}
      </div>

      {/* View list */}
      <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '8px' }}>
        <button
          onClick={() => handleLoadView(null)}
          style={{
            ...btnBase, width: '100%', textAlign: 'left',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: !activeViewId ? 'rgba(20,184,166,0.25)' : 'rgba(255,255,255,0.05)',
            color: !activeViewId ? '#5eead4' : '#cbd5e1',
            marginBottom: '2px', padding: '5px 8px',
          }}
        >
          <span>Default</span>
        </button>

        {savedViews.map((v) => (
          <div
            key={v.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px',
            }}
          >
            <button
              onClick={() => handleLoadView(v)}
              style={{
                ...btnBase, flex: 1, textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: v.id === activeViewId ? 'rgba(20,184,166,0.25)' : 'rgba(255,255,255,0.05)',
                color: v.id === activeViewId ? '#5eead4' : '#cbd5e1',
                padding: '5px 8px',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
              {v.is_default && <span style={{ fontSize: '9px', color: '#facc15', marginLeft: '4px' }}>★</span>}
            </button>
            {confirmDeleteId === v.id ? (
              <button
                onClick={() => { handleDeleteView(v.id); setConfirmDeleteId(null); }}
                style={{ ...btnBase, background: '#ef4444', color: '#fff', fontSize: '9px', padding: '3px 5px' }}
              >
                Yes
              </button>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(v.id)}
                style={{ ...btnBase, background: 'none', color: '#64748b', fontSize: '11px', padding: '2px 4px' }}
                title="Delete view"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Create new view */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <input
          type="text"
          value={newViewName}
          onChange={(e) => setNewViewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newViewName.trim()) {
              handleCreateView(newViewName.trim());
              setNewViewName('');
            }
          }}
          placeholder="New view name…"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '11px',
            outline: 'none', fontFamily: 'monospace',
          }}
        />
        <button
          onClick={() => {
            if (newViewName.trim()) {
              handleCreateView(newViewName.trim());
              setNewViewName('');
            }
          }}
          style={{
            ...btnBase, background: '#14b8a6', color: '#fff', fontWeight: 'bold',
            padding: '4px 10px',
          }}
        >
          +
        </button>
      </div>

      {savedViews.length === 0 && (
        <div style={{ color: '#64748b', fontSize: '10px', textAlign: 'center', marginTop: '6px' }}>
          No saved views yet — create one from the 2D Dependencies page
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ToolbarPlaceholder — visual replica of toolbar chrome (no logic)
// ══════════════════════════════════════════════════════════════════

export function ToolbarPlaceholder({ savedViews, activeViewId, activeViewName, handleLoadView, handleNextView, handlePrevView, handleSaveView, handleCreateView, viewFlashName }) {
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  return (
    <div className="mb-4">
      {/* Toggle tabs */}
      <div className="flex items-end gap-0.5 ml-1">
        <button className="px-3 py-1 rounded-t-md bg-white border border-b-0 border-slate-200 text-slate-400 text-xs flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>
          <span className="text-[10px]">Show</span>
        </button>
        <button className="px-3 py-1 rounded-t-md bg-white border border-b-0 border-slate-200 text-slate-400 text-xs flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 11h3v10h2V11h3l-4-4-4 4zM4 3v2h16V3H4z"/></svg>
          <span className="text-[10px]">Header</span>
        </button>
      </div>

      {/* Toolbar body */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex divide-x divide-slate-200 px-3 py-2.5">
          {/* Mode section */}
          <div className="pr-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Mode</div>
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg" style={{ width: '170px' }}>
              {['View', 'Edit', 'Deps', 'Refact.'].map((label, i) => (
                <button
                  key={label}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md ${i === 0 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Create section */}
          <div className="px-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Create</div>
            <div className="grid grid-cols-2 gap-1" style={{ width: '130px' }}>
              {['Team', 'Task', 'Mile.', 'Phase'].map((label) => (
                <button key={label} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600">
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Delete section */}
          <div className="px-3 flex items-center">
            <button className="flex flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-xs font-medium rounded-md border border-slate-200 text-slate-300 cursor-not-allowed" style={{ width: '70px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              <span className="text-[10px]">Delete</span>
            </button>
          </div>
          {/* Display section */}
          <div className="px-3 flex-1">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Display</div>
            <div className="flex gap-2">
              {['Timeline', 'Hide Deps', 'Coll. Deps', 'Coll. All'].map((label) => (
                <button key={label} className="px-2 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600">
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Sizing section */}
          <div className="px-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Sizing</div>
            <div className="space-y-1" style={{ width: '210px' }}>
              {[
                { label: 'Day W', val: DEFAULT_DAYWIDTH },
                { label: 'Task H', val: DEFAULT_TASKHEIGHT_NORMAL },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 w-12">{label}</span>
                  <input type="range" className="flex-1" disabled />
                  <span className="text-[11px] text-slate-500 w-6 text-right tabular-nums">{val}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Views section */}
          <div className="pl-3 relative">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Views</div>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevView}
                className="px-1.5 py-1.5 text-xs rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                title="Previous view"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              </button>
              <button
                onClick={() => setShowViewMenu((v) => !v)}
                className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-teal-400 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                style={{ minWidth: '120px' }}
              >
                <span className="truncate">{activeViewName || 'Default'}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><path d="M7 10l5 5 5-5z"/></svg>
              </button>
              <button
                onClick={handleNextView}
                className="px-1.5 py-1.5 text-xs rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                title="Next view"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
              </button>
              {activeViewId && (
                <button
                  onClick={handleSaveView}
                  className="px-1.5 py-1.5 text-xs rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                  title="Save current view"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
                </button>
              )}
            </div>
            {showViewMenu && (
              <div
                className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50"
                style={{ minWidth: '200px' }}
              >
                <div className="py-1">
                  <button
                    onClick={() => { handleLoadView(null); setShowViewMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${!activeViewId ? 'bg-teal-50 text-teal-700 font-medium' : 'text-slate-600'}`}
                  >
                    Default
                  </button>
                  {savedViews.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => { handleLoadView(v); setShowViewMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center justify-between ${v.id === activeViewId ? 'bg-teal-50 text-teal-700 font-medium' : 'text-slate-600'}`}
                    >
                      <span className="truncate">{v.name}</span>
                      {v.is_default && <span className="text-[9px] text-teal-500 ml-2">★</span>}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 p-2">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newViewName.trim()) {
                          handleCreateView(newViewName.trim());
                          setNewViewName('');
                          setShowViewMenu(false);
                        }
                      }}
                      placeholder="New view name..."
                      className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded"
                    />
                    <button
                      onClick={() => {
                        if (newViewName.trim()) {
                          handleCreateView(newViewName.trim());
                          setNewViewName('');
                          setShowViewMenu(false);
                        }
                      }}
                      className="px-2 py-1 text-xs rounded bg-teal-500 text-white hover:bg-teal-600"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
            {viewFlashName && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-teal-500 text-white text-xs font-medium whitespace-nowrap shadow-lg animate-pulse">
                {viewFlashName.name}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// DayGrid — per-team day cell grid (display only)
// ══════════════════════════════════════════════════════════════════

export function DayGrid({ team, tasks, days, DAYWIDTH, taskDisplaySettings, teamPhasesMap, phases, teamColor, totalDaysWidth, thSmall, thNormal, isCollapsed }) {
  const visibleTasks_ = isCollapsed ? [] : getVisibleTasks(team, taskDisplaySettings);
  const teamPhases = teamPhasesMap[team.id] || [];
  const phaseRowH = !isCollapsed && teamPhases.length > 0 ? TEAM_PHASE_ROW_HEIGHT : 0;
  const teamRowH = getTeamRowHeight(team, taskDisplaySettings, phaseRowH, isCollapsed, thSmall, thNormal) - phaseRowH;

  const phaseColorMap = useMemo(() => {
    const map = {};
    for (const p of phases) {
      if (p.team != null && String(p.team) !== String(team.id)) continue;
      for (let d = p.start_index; d < p.start_index + p.duration; d++) {
        map[d] = p.color || '#3b82f6';
      }
    }
    return map;
  }, [phases, team.id]);

  return (
    <div
      className="border-y border-slate-200"
      style={{ width: `${totalDaysWidth}px`, height: `${teamRowH}px`, position: 'relative', backgroundColor: '#fafbfc' }}
    >
      {visibleTasks_.map((taskId, tIdx) => {
        const th = getTaskHeight(taskId, taskDisplaySettings, thSmall, thNormal);
        const yOff = getTaskYOffset(taskId, team, taskDisplaySettings, thSmall, thNormal);
        return (
          <div
            key={taskId}
            className="absolute"
            style={{
              top: `${yOff}px`,
              left: 0,
              width: `${totalDaysWidth}px`,
              height: `${th}px`,
              borderBottom: tIdx < visibleTasks_.length - 1 ? '1px solid #e2e8f0' : 'none',
            }}
          >
            {Array.from({ length: days }, (_, i) => {
              const colX = i * DAYWIDTH;
              const phaseColor = phaseColorMap[i];
              return (
                <div
                  key={i}
                  className="absolute top-0 border-r border-slate-100"
                  style={{
                    left: `${colX}px`,
                    width: `${DAYWIDTH}px`,
                    height: `${th}px`,
                    backgroundColor: phaseColor
                      ? `${phaseColor}14`
                      : undefined,
                    ...(phaseColor ? {
                      backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent 4px, ${phaseColor}0a 4px, ${phaseColor}0a 8px)`,
                    } : {}),
                  }}
                />
              );
            })}
          </div>
        );
      })}
      {visibleTasks_.length === 0 && (
        <div
          className="w-full h-full"
          style={{
            backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(148,163,184,0.06) 4px, rgba(148,163,184,0.06) 8px)',
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MilestoneLayer — positioned absolute overlay for milestones
// ══════════════════════════════════════════════════════════════════

export function MilestoneLayer({ teamOrder, teams, milestones, taskDisplaySettings, teamDisplaySettings, teamPhasesMap, effectiveHeaderH, TEAMWIDTH, TASKWIDTH, DAYWIDTH, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL }) {
  const positioned = useMemo(() => {
    return computeMilestonePixelPositions({
      teamOrder, teams, milestones, taskDisplaySettings,
      teamDisplaySettings,
      teamPhasesMap, effectiveHeaderH,
      TEAMWIDTH, TASKWIDTH, DAYWIDTH,
      TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL,
    }).map((m) => ({ ...m, y: m.y + 2, h: m.h - 4 }));
  }, [teamOrder, teams, taskDisplaySettings, teamDisplaySettings, milestones, effectiveHeaderH, teamPhasesMap, TEAMWIDTH, TASKWIDTH, DAYWIDTH, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL]);

  return (
    <div className="absolute top-0 left-0 w-full h-full" style={{ zIndex: 20, pointerEvents: 'none' }}>
      {positioned.map((m) => (
        <div
          key={m.id}
          className="absolute rounded cursor-pointer"
          style={{
            left: `${m.x}px`,
            top: `${m.y}px`,
            width: `${m.w}px`,
            height: `${m.h}px`,
            backgroundColor: m.color || m.teamColor || '#facc15',
            pointerEvents: 'auto',
          }}
        >
          <span className="text-xs truncate px-2 leading-none flex items-center h-full" style={{ color: getContrastTextColor(m.color || m.teamColor || '#facc15'), textShadow: 'none' }}>
            {m.name}
          </span>
        </div>
      ))}
    </div>
  );
}
