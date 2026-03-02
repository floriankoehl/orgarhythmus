import { useState, useEffect, useCallback } from 'react';
import { playSound } from '../assets/sound_registry';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessDoubleIcon from '@mui/icons-material/UnfoldLessDouble';
import UnfoldMoreDoubleIcon from '@mui/icons-material/UnfoldMoreDouble';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SettingsIcon from '@mui/icons-material/Settings';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FlagIcon from '@mui/icons-material/Flag';
import FilterListIcon from '@mui/icons-material/FilterList';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import BuildIcon from '@mui/icons-material/Build';
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ViewListIcon from '@mui/icons-material/ViewList';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import RestoreIcon from '@mui/icons-material/Restore';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import CloseIcon from '@mui/icons-material/Close';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';

import {
  DEFAULT_ROWHEIGHT_NORMAL,
  DEFAULT_ROWHEIGHT_SMALL,
  DEFAULT_COLUMNWIDTH,
} from './layoutMath';

/**
 * ToolbarSection — stable component (defined outside GridToolbar) that renders
 * a toolbar section either inline (full-page) or as a collapsible accordion
 * (floating window).  Being top-level means React keeps a stable reference
 * and never unmounts sections just because the parent re-renders.
 */
function ToolbarSection({ sectionKey, label, icon, width, children, flex, className = '', isFloating, isOpen, onToggle }) {
  if (!isFloating) {
    return (
      <div
        className={`p-2.5 flex-shrink-0 ${flex ? 'flex-1 min-w-0' : ''} ${className}`}
        style={!flex && width ? { width } : undefined}
      >
        {label && (
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            {label}
          </h3>
        )}
        {children}
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-full border-b border-slate-100 last:border-b-0">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(sectionKey); }}
        className={`flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs font-medium transition ${
          isOpen ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        {icon}
        <span>{label}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          className={`ml-auto transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
        >
          <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div
          className={`px-2.5 pb-2 pt-1 ${className}`}
          style={width ? { minWidth: width } : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Generic toolbar for the grid board.
 *
 * All domain-specific labels are injected via *Label props so the
 * same toolbar can read "Teams / Tasks / Milestones / Dependencies / Days"
 * or any other vocabulary the adapter supplies.
 */
export default function GridToolbar({
  // ── Floating window mode ──
  isFloating = false,
  /** When true, toolbar uses vertical accordion layout (narrow window). When false in floating, uses horizontal. */
  compactToolbar = false,
  // ── Customisable labels ──
  laneLabel   = 'Lane',
  rowLabel    = 'Row',
  nodeLabel   = 'Node',
  edgeLabel   = 'Edge',
  columnLabel = 'Column',

  // Data
  laneOrder,
  lanes,
  // Filter state
  laneDisplaySettings,
  setLaneDisplaySettings,
  showFilterDropdown,
  setShowFilterDropdown,
  // View mode
  viewMode,
  setViewMode,
  mode,
  baseViewModeRef,
  // Auto-select
  autoSelectBlocking,
  setAutoSelectBlocking,
  // Resize behavior
  resizeAllSelected,
  setResizeAllSelected,
  // Warning settings
  warningDuration,
  setWarningDuration,
  // Settings dropdown
  showSettingsDropdown,
  setShowSettingsDropdown,
  // Visibility settings
  hideAllEdges,
  setHideAllEdges,
  hideCollapsedEdges,
  setHideCollapsedEdges,
  hideCollapsedNodes,
  setHideCollapsedNodes,
  showEmptyLanes,
  setShowEmptyLanes,
  // Dimension settings
  customColumnWidth,
  setCustomColumnWidth,
  customRowHeightNormal,
  setCustomRowHeightNormal,
  customRowHeightSmall,
  setCustomRowHeightSmall,
  // Create modals
  setShowCreateLaneModal,
  setShowCreateRowModal,
  setNewRowLaneId,
  // Node adding
  isAddingNode,
  setIsAddingNode,
  safeMode,
  // Computed values
  hiddenLaneCount,
  // Functions
  isLaneVisible,
  setLaneRowsSmall,
  setLaneRowsNormal,
  showAllHiddenLanes,
  // Selection state for delete
  selectedNodes,
  selectedEdges,
  // Delete handler
  onDeleteSelected,
  onBulkUpdateEdges,
  // Refactor mode
  refactorMode,
  setRefactorMode,
  // Expanded row view (Gantt)
  expandedRowView,
  setExpandedRowView,
  // Collapse/expand all lanes
  collapseAllLanes,
  expandAllLanes,
  // Edge display settings
  edgeSettings = {},
  setEdgeSettings,
  // Edge editing
  allEdges,
  handleUpdateEdge,
  setEdgeEditModal,
  // Column selection & collapse
  selectedColumns,
  collapsedColumns,
  collapseSelectedColumns,
  uncollapseAllColumns,
  clearColumnSelection,
  // Phases
  phases = [],
  setPhaseEditModal,
  // Phase colors in grid
  showPhaseColorsInGrid,
  setShowPhaseColorsInGrid,
  // Lane phase row controls
  collapsedLanePhaseRows,
  collapseAllLanePhases,
  showAllLanePhases,
  hideAllLanePhases,
  lanePhasesMap = {},
  // Views
  savedViews = [],
  activeViewId,
  activeViewName,
  onLoadView,
  onSaveView,
  onCreateView,
  onRenameView,
  onDeleteView,
  onSetDefaultView,
  onUpdateViewShortcut,
  viewShortcuts = {},
  // Snapshots
  snapshots = [],
  snapshotsLoading,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onRenameSnapshot,
  // Layout visibility
  hideGlobalPhases,
  setHideGlobalPhases,
  // Sound toggle
  soundEnabled,
  setSoundEnabled,
  // Column header toggle
  hideColumnHeader,
  setHideColumnHeader,
  // Lane / row label column collapse
  hideLaneLabels,
  setHideLaneLabels,
  hideRowLabels,
  setHideRowLabels,
  // Row actions column collapse
  hideRowActions,
  setHideRowActions,
  // Fullscreen
  isFullscreen,
  toggleFullscreen,
  // State indicators
  allRowsSmall,
  allLanesCollapsed,
  // Popup close signal
  popupCloseSignal = 0,
  // User shortcuts
  userShortcuts = {},
  onSaveShortcuts,
  // Safety check
  onRunSafetyCheck,
  safetyCheckRunning,
}) {
  const hasSelection = selectedNodes?.size > 0 || selectedEdges?.length > 0;

  // Plural helper (simple s-suffix)
  const pl = (label, n) => (n === 1 ? label : `${label}s`);

  // ── View UI state ──
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [isCreatingView, setIsCreatingView] = useState(false);
  const [renamingViewId, setRenamingViewId] = useState(null);
  const [renameText, setRenameText] = useState("");
  const [confirmDeleteViewId, setConfirmDeleteViewId] = useState(null);
  const [editingShortcutViewId, setEditingShortcutViewId] = useState(null);

  // Close all local dropdowns when canvas is clicked
  useEffect(() => {
    if (popupCloseSignal > 0) {
      setShowViewDropdown(false);
      setShowSnapshotDropdown(false);
      setOpenSections(new Set());
    }
  }, [popupCloseSignal]);

  // ── Snapshot UI state ──
  const [showSnapshotDropdown, setShowSnapshotDropdown] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState("");
  const [newSnapshotDesc, setNewSnapshotDesc] = useState("");
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState(null);
  const [confirmDeleteSnapshotId, setConfirmDeleteSnapshotId] = useState(null);
  const [renamingSnapshotId, setRenamingSnapshotId] = useState(null);
  const [renameSnapshotText, setRenameSnapshotText] = useState("");

  // ── Shortcuts modal state ──
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [editingShortcuts, setEditingShortcuts] = useState({});

  // Enter/Escape key support for shortcuts modal
  const saveShortcutsAndClose = useCallback(() => {
    if (onSaveShortcuts) onSaveShortcuts(editingShortcuts);
    setShowShortcutsModal(false);
    playSound('settingToggle');
  }, [editingShortcuts, onSaveShortcuts]);

  useEffect(() => {
    if (!showShortcutsModal) return;
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') { setShowShortcutsModal(false); }
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); saveShortcutsAndClose(); }
      if (e.key === 'Escape') { setShowShortcutsModal(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showShortcutsModal, saveShortcutsAndClose]);
  
  // Compute how many lanes are hidden via laneDisplaySettings
  const filteredLaneCount = laneOrder.filter(lid => laneDisplaySettings[lid]?.hidden).length;
  const allLanesHidden = filteredLaneCount === laneOrder.length;
  const noLanesHidden = filteredLaneCount === 0;
  
  const getDeleteLabel = () => {
    if (selectedEdges?.length > 0) return selectedEdges.length > 1 ? `${selectedEdges.length} ${pl(edgeLabel, selectedEdges.length)}` : edgeLabel;
    if (selectedNodes?.size > 1) return `${selectedNodes.size}`;
    if (selectedNodes?.size === 1) return '1';
    return '';
  };

  const getDeleteTooltip = () => {
    if (selectedEdges?.length > 0) return `Delete ${selectedEdges.length} selected ${pl(edgeLabel.toLowerCase(), selectedEdges.length)}`;
    if (selectedNodes?.size > 1) return `Delete ${selectedNodes.size} ${pl(nodeLabel.toLowerCase(), selectedNodes.size)}`;
    if (selectedNodes?.size === 1) return `Delete selected ${nodeLabel.toLowerCase()}`;
    return `Select ${pl(nodeLabel.toLowerCase(), 2)} or ${pl(edgeLabel.toLowerCase(), 2)} to delete`;
  };

  // ── Expanded sections for floating mode (accordion) ──
  const [openSections, setOpenSections] = useState(new Set());

  const toggleSection = useCallback((key) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Helper: shorthand props threaded to every ToolbarSection
  const sectionProps = { isFloating: compactToolbar, onToggle: toggleSection };

  return (
    <>
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={compactToolbar ? "flex flex-col" : "flex divide-x divide-slate-200"}>

        {/* ─── COL 1: Mode (2×2 grid) ─── */}
        <ToolbarSection sectionKey="mode" label="Mode" icon={<VisibilityIcon style={{ fontSize: 14 }} />} width={170} isOpen={openSections.has('mode')} {...sectionProps}>
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg" style={{ width: 170 }}>
            {[
              { key: 'inspection', icon: <VisibilityIcon style={{ fontSize: 15 }} />, label: 'View',    shortcut: 'V' },
              { key: 'schedule',   icon: <ScheduleIcon style={{ fontSize: 15 }} />,   label: 'Edit',    shortcut: 'E' },
              { key: 'dependency', icon: <AccountTreeIcon style={{ fontSize: 15 }} />, label: 'Deps',    shortcut: 'D' },
              { key: 'refactor',   icon: <BuildIcon style={{ fontSize: 15 }} />,       label: 'Refact.', isRefactor: true },
            ].map(m => {
              const isActive = m.isRefactor ? refactorMode : viewMode === m.key;
              return (
                <button
                  key={m.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (m.isRefactor) { setRefactorMode(!refactorMode); playSound('refactorToggle'); }
                    else { setViewMode(m.key); baseViewModeRef.current = m.key; playSound('modeSwitch'); }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition btn-press ${
                    isActive
                      ? m.isRefactor
                        ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-300 shadow-sm'
                        : 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title={m.isRefactor ? (refactorMode ? 'Exit refactor' : 'Refactor mode') : `${m.label} mode (${m.shortcut})`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </ToolbarSection>

        {/* ─── COL 2: Create (no delete) ─── */}
        <ToolbarSection sectionKey="create" label="Create" icon={<AddIcon style={{ fontSize: 14 }} />} width={130} isOpen={openSections.has('create')} {...sectionProps}>
          <div className="grid grid-cols-2 gap-1" style={{ width: 130 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowCreateLaneModal(true); }}
              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition btn-press"
              title={`New ${laneLabel.toLowerCase()}`}
            >
              <GroupAddIcon style={{ fontSize: 14 }} />
              <span>{laneLabel}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const firstReal = laneOrder.find(lid => !lanes[lid]?._virtual);
                if (firstReal) { setNewRowLaneId(firstReal); setShowCreateRowModal(true); }
              }}
              disabled={laneOrder.filter(lid => !lanes[lid]?._virtual).length === 0}
              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 btn-press"
              title={`New ${rowLabel.toLowerCase()}`}
            >
              <PlaylistAddIcon style={{ fontSize: 14 }} />
              <span>{rowLabel}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsAddingNode(!isAddingNode); }}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition btn-press ${
                isAddingNode ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title={isAddingNode ? `Click ${rowLabel.toLowerCase()} row to place` : `Add ${nodeLabel.toLowerCase()}`}
            >
              <FlagIcon style={{ fontSize: 14 }} />
              <span>{nodeLabel.length > 5 ? nodeLabel.slice(0, 4) + '.' : nodeLabel}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (setPhaseEditModal) setPhaseEditModal({ mode: 'create', start_index: 0, duration: 7, name: '', color: '#3b82f6', team: null });
              }}
              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition btn-press"
              title="Add a new phase"
            >
              <ViewTimelineIcon style={{ fontSize: 14 }} />
              <span>Phase</span>
            </button>
          </div>
          {isAddingNode && (
            <p className="text-[10px] text-blue-600 mt-1 leading-tight" style={{ width: 130 }}>Click a {columnLabel.toLowerCase()} cell to place.</p>
          )}
        </ToolbarSection>

        {/* ─── COL 3: Delete (narrow) ─── */}
        <ToolbarSection sectionKey="delete" label="Delete" icon={<DeleteIcon style={{ fontSize: 14 }} />} width={70} className="flex flex-col justify-center" isOpen={openSections.has('delete')} {...sectionProps}>
          <button
            onClick={(e) => { e.stopPropagation(); if (hasSelection) onDeleteSelected(); }}
            disabled={!hasSelection}
            className={`w-full flex flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-xs font-medium rounded-md border transition ${
              hasSelection
                ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                : 'border-slate-200 text-slate-300 cursor-not-allowed'
            }`}
            title={getDeleteTooltip()}
          >
            <DeleteIcon style={{ fontSize: 18 }} />
            <span className="text-[10px]">{hasSelection ? getDeleteLabel() : 'Delete'}</span>
          </button>
        </ToolbarSection>

        {/* ─── COL 3.5: Selected (contextual) ─── */}
        <ToolbarSection sectionKey="selected" label="Selected" icon={<VisibilityIcon style={{ fontSize: 14 }} />} width={100} isOpen={openSections.has('selected')} {...sectionProps}>
          <div className="flex flex-col gap-1">
            {/* Show hidden lanes */}
            {hiddenLaneCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); showAllHiddenLanes(); }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
              >
                <VisibilityIcon style={{ fontSize: 14 }} />
                <span>{hiddenLaneCount} Hidden</span>
              </button>
            )}

            {/* Lane phases visibility */}
            {(collapsedLanePhaseRows?.size > 0 || collapseAllLanePhases) && (
              <button
                onClick={(e) => { e.stopPropagation(); showAllLanePhases(); }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
                title={`Show ${laneLabel.toLowerCase()} phase rows`}
              >
                <VisibilityIcon style={{ fontSize: 14 }} />
                <span>L-Phases</span>
              </button>
            )}
            {!collapseAllLanePhases && Object.values(lanePhasesMap).some(arr => arr?.length > 0) && (
              <button
                onClick={(e) => { e.stopPropagation(); hideAllLanePhases(); }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                title={`Hide ${laneLabel.toLowerCase()} phase rows`}
              >
                <VisibilityOffIcon style={{ fontSize: 14 }} />
                <span>L-Phases</span>
              </button>
            )}

            {/* Global phases visibility */}
            {phases.some(p => p.team == null) && (
              <button
                onClick={(e) => { e.stopPropagation(); setHideGlobalPhases(!hideGlobalPhases); playSound('settingToggle'); }}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition ${
                  hideGlobalPhases
                    ? 'border-amber-400 bg-amber-50 text-amber-700 ring-1 ring-amber-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title={hideGlobalPhases ? "Show global phases row" : "Hide global phases row"}
              >
                {hideGlobalPhases ? <VisibilityOffIcon style={{ fontSize: 14 }} /> : <VisibilityIcon style={{ fontSize: 14 }} />}
                <span>Phases</span>
              </button>
            )}

            {/* Column collapse/expand */}
            {selectedColumns?.size > 0 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); collapseSelectedColumns(); }}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                  title={`Collapse ${selectedColumns.size} selected ${pl(columnLabel.toLowerCase(), selectedColumns.size)}`}
                >
                  <UnfoldLessIcon style={{ fontSize: 14 }} />
                  <span>{selectedColumns.size}c</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); clearColumnSelection(); }}
                  className="px-1.5 py-1.5 text-xs rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50 transition"
                  title={`Clear ${columnLabel.toLowerCase()} selection`}
                >
                  ✕
                </button>
              </div>
            )}
            {collapsedColumns?.size > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); uncollapseAllColumns(); }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                title={`Expand ${collapsedColumns.size} collapsed ${pl(columnLabel.toLowerCase(), collapsedColumns.size)}`}
              >
                <UnfoldMoreIcon style={{ fontSize: 14 }} />
                <span>{collapsedColumns.size}c</span>
              </button>
            )}
          </div>
        </ToolbarSection>

        {/* ─── COL 4: Filter ─── */}
        <ToolbarSection sectionKey="filter" label="Filter" icon={<FilterListIcon style={{ fontSize: 14 }} />} width={90} isOpen={openSections.has('filter')} {...sectionProps}>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowFilterDropdown(!showFilterDropdown); }}
              className={`w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-md border transition ${
                filteredLaneCount > 0
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : showFilterDropdown
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FilterListIcon style={{ fontSize: 15 }} />
              <span>{filteredLaneCount > 0 ? filteredLaneCount : pl(laneLabel, 2)}</span>
            </button>
            
            {showFilterDropdown && (
              <div 
                className="absolute top-full right-0 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-xl z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-medium text-slate-700">Show {pl(laneLabel.toLowerCase(), 2)}:</span>
                    <div className="flex gap-2">
                      {!noLanesHidden && (
                        <button
                          onClick={() => {
                            const updates = {};
                            laneOrder.forEach(lid => { updates[lid] = { ...(laneDisplaySettings[lid] || {}), hidden: false }; });
                            setLaneDisplaySettings(prev => ({ ...prev, ...updates }));
                            playSound('teamFilter');
                          }}
                          className="text-[10px] text-blue-600 hover:underline"
                        >All</button>
                      )}
                      {!allLanesHidden && (
                        <button
                          onClick={() => {
                            const updates = {};
                            laneOrder.forEach(lid => { updates[lid] = { ...(laneDisplaySettings[lid] || {}), hidden: true }; });
                            setLaneDisplaySettings(prev => ({ ...prev, ...updates }));
                            playSound('teamFilter');
                          }}
                          className="text-[10px] text-slate-500 hover:underline"
                        >None</button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {laneOrder.map((laneId) => {
                      const lane = lanes[laneId];
                      if (!lane || lane._virtual) return null;
                      const isHidden = laneDisplaySettings[laneId]?.hidden;
                      return (
                        <label key={laneId} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!isHidden}
                            onChange={() => { setLaneDisplaySettings(prev => ({ ...prev, [laneId]: { ...(prev[laneId] || {}), hidden: !isHidden } })); playSound('teamFilter'); }}
                            className="rounded border-slate-300"
                          />
                          <span className="text-xs text-slate-700 truncate flex-1">{lane.name}</span>
                          <span className="text-[10px] text-slate-400">{lane.rows?.length || 0}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ToolbarSection>

        {/* ─── COL 5: Display (flex area) ─── */}
        <ToolbarSection sectionKey="display" label="Display" icon={<ViewTimelineIcon style={{ fontSize: 14 }} />} flex isOpen={openSections.has('display')} {...sectionProps}>
          <div className="flex gap-2 items-start">
            {/* Left sub-column: Rows + Lanes stacked vertically */}
            <div className="flex flex-col gap-1 flex-shrink-0">
              {/* Row height: collapse / expand */}
              <div className="flex items-center gap-0.5 rounded-md border border-slate-200 overflow-hidden" style={{ minWidth: 200 }}>
                <span className="text-[10px] text-slate-400 font-medium px-1.5 bg-slate-50 self-stretch flex items-center" style={{ width: 38 }}>{pl(rowLabel, 2)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); laneOrder.forEach(lid => { if (isLaneVisible(lid)) setLaneRowsSmall(lid); }); }}
                  className={`flex items-center gap-0.5 px-2 py-1.5 text-xs flex-1 transition ${
                    allRowsSmall ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  title={`Collapse all ${rowLabel.toLowerCase()} rows to small size`}
                >
                  <UnfoldLessIcon style={{ fontSize: 14 }} />
                  <span>Collapse</span>
                </button>
                <div className="w-px h-5 bg-slate-200" />
                <button
                  onClick={(e) => { e.stopPropagation(); laneOrder.forEach(lid => { if (isLaneVisible(lid)) setLaneRowsNormal(lid); }); }}
                  className={`flex items-center gap-0.5 px-2 py-1.5 text-xs flex-1 transition ${
                    !allRowsSmall ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  title={`Expand all ${rowLabel.toLowerCase()} rows to normal size`}
                >
                  <UnfoldMoreIcon style={{ fontSize: 14 }} />
                  <span>Expand</span>
                </button>
              </div>

              {/* Lane rows: fold / unfold */}
              <div className="flex items-center gap-0.5 rounded-md border border-slate-200 overflow-hidden" style={{ minWidth: 200 }}>
                <span className="text-[10px] text-slate-400 font-medium px-1.5 bg-slate-50 self-stretch flex items-center" style={{ width: 38 }}>{pl(laneLabel, 2)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); collapseAllLanes(); }}
                  className={`flex items-center gap-0.5 px-2 py-1.5 text-xs flex-1 transition ${
                    allLanesCollapsed ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  title={`Fold all ${pl(laneLabel.toLowerCase(), 2)} — hide their ${rowLabel.toLowerCase()} rows`}
                >
                  <UnfoldLessDoubleIcon style={{ fontSize: 14 }} />
                  <span>Fold</span>
                </button>
                <div className="w-px h-5 bg-slate-200" />
                <button
                  onClick={(e) => { e.stopPropagation(); expandAllLanes(); }}
                  className={`flex items-center gap-0.5 px-2 py-1.5 text-xs flex-1 transition ${
                    !allLanesCollapsed ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  title={`Unfold all ${pl(laneLabel.toLowerCase(), 2)} — show their ${rowLabel.toLowerCase()} rows`}
                >
                  <UnfoldMoreDoubleIcon style={{ fontSize: 14 }} />
                  <span>Unfold</span>
                </button>
              </div>
            </div>

            {/* Middle: 2×2 visibility grid */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {/* 2×2 grid: Timeline, Hide Edges, Coll. Edges, Coll. All */}
              <div className="grid grid-cols-2 gap-1" style={{ maxWidth: 240 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedRowView(!expandedRowView); playSound('settingToggle'); }}
                  className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition ${
                    expandedRowView
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title={expandedRowView ? `Hide ${rowLabel.toLowerCase()} time spans` : `Show ${rowLabel.toLowerCase()} time spans`}
                >
                  <ViewTimelineIcon style={{ fontSize: 14 }} />
                  <span>Timeline</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setHideAllEdges(!hideAllEdges); playSound('settingToggle'); }}
                  className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition ${
                    hideAllEdges
                      ? 'border-red-400 bg-red-50 text-red-700 ring-1 ring-red-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title={hideAllEdges ? `Show all ${pl(edgeLabel.toLowerCase(), 2)}` : `Hide all ${edgeLabel.toLowerCase()} lines`}
                >
                  <AccountTreeIcon style={{ fontSize: 14 }} />
                  <span>{hideAllEdges ? `${pl(edgeLabel, 2)} Hidden` : `Hide ${pl(edgeLabel, 2)}`}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setHideCollapsedEdges(!hideCollapsedEdges); if (!hideCollapsedEdges) setHideCollapsedNodes(false); playSound('settingToggle'); }}
                  className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition ${
                    hideCollapsedEdges
                      ? 'border-orange-400 bg-orange-50 text-orange-700 ring-1 ring-orange-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title={hideCollapsedEdges ? `Show ${pl(edgeLabel.toLowerCase(), 2)} for collapsed ${pl(rowLabel.toLowerCase(), 2)}` : `Hide ${pl(edgeLabel.toLowerCase(), 2)} for collapsed ${pl(rowLabel.toLowerCase(), 2)}`}
                >
                  <VisibilityOffIcon style={{ fontSize: 14 }} />
                  <span>Coll. {pl(edgeLabel, 2)}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setHideCollapsedNodes(!hideCollapsedNodes); if (!hideCollapsedNodes) setHideCollapsedEdges(false); playSound('settingToggle'); }}
                  className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition ${
                    hideCollapsedNodes
                      ? 'border-orange-400 bg-orange-50 text-orange-700 ring-1 ring-orange-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title={hideCollapsedNodes ? `Show ${pl(edgeLabel.toLowerCase(), 2)} & ${pl(nodeLabel.toLowerCase(), 2)} for collapsed` : `Hide ${pl(edgeLabel.toLowerCase(), 2)} & ${pl(nodeLabel.toLowerCase(), 2)} for collapsed ${pl(rowLabel.toLowerCase(), 2)}`}
                >
                  <VisibilityOffIcon style={{ fontSize: 14 }} />
                  <span>Coll. All</span>
                </button>
              </div>
            </div>
          </div>
        </ToolbarSection>

        {/* ─── COL 5b: Advanced (Shortcuts, Safety, Settings) ─── */}
        <ToolbarSection sectionKey="advanced" label="Advanced" icon={<SettingsIcon style={{ fontSize: 14 }} />} width={280} isOpen={openSections.has('advanced')} {...sectionProps}>
          <div className="flex gap-2 items-start">
            {/* Shortcuts button */}
            <div className="flex-shrink-0 self-stretch flex">
              <button
                onClick={(e) => { e.stopPropagation(); setEditingShortcuts({ ...userShortcuts }); setShowShortcutsModal(true); }}
                className="flex flex-col items-center justify-center gap-0.5 px-3 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                title="Customize keyboard shortcuts"
              >
                <KeyboardIcon style={{ fontSize: 18 }} />
                <span>Shortcuts</span>
              </button>
            </div>

            {/* Safety Check button */}
            <div className="flex-shrink-0 self-stretch flex">
              <button
                onClick={(e) => { e.stopPropagation(); if (onRunSafetyCheck) onRunSafetyCheck(); }}
                disabled={safetyCheckRunning}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 text-xs font-medium rounded-md border transition ${
                  safetyCheckRunning
                    ? 'border-blue-300 bg-blue-50 text-blue-500 cursor-wait'
                    : 'border-green-300 text-green-700 hover:bg-green-50'
                }`}
                title="Run safety check — validate all scheduling rules"
              >
                <VerifiedUserIcon style={{ fontSize: 18 }} />
                <span>{safetyCheckRunning ? 'Checking…' : 'Safety'}</span>
              </button>
            </div>

            {/* Settings button with dropdown */}
            <div className="relative flex-shrink-0 self-stretch flex">
              <button
                onClick={(e) => { e.stopPropagation(); setShowSettingsDropdown(!showSettingsDropdown); }}
                className={`flex flex-col items-center justify-center gap-0.5 px-4 text-xs font-medium rounded-md border transition ${
                  showSettingsDropdown
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <SettingsIcon style={{ fontSize: 18 }} />
                <span>Settings</span>
              </button>
              
              {showSettingsDropdown && (
                <div 
                  className="absolute top-full left-0 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-xl z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-3 space-y-3">
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Visibility</h4>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={showEmptyLanes} onChange={(e) => { setShowEmptyLanes(e.target.checked); playSound('settingToggle'); }} className="rounded border-slate-300" />
                        <span>Show empty {pl(laneLabel.toLowerCase(), 2)}</span>
                      </label>
                      {phases.length > 0 && (
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={showPhaseColorsInGrid} onChange={(e) => { setShowPhaseColorsInGrid(e.target.checked); playSound('settingToggle'); }} className="rounded border-slate-300" />
                          <span>Show phase colors in grid</span>
                        </label>
                      )}
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={!hideColumnHeader} onChange={(e) => { setHideColumnHeader(!e.target.checked); playSound('settingToggle'); }} className="rounded border-slate-300" />
                        <span>Show {columnLabel.toLowerCase()} header row</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={!hideLaneLabels} onChange={(e) => { setHideLaneLabels(!e.target.checked); playSound('settingToggle'); }} className="rounded border-slate-300" />
                        <span>Show {laneLabel.toLowerCase()} labels column</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={!hideRowLabels} onChange={(e) => { setHideRowLabels(!e.target.checked); playSound('settingToggle'); }} className="rounded border-slate-300" />
                        <span>Show {rowLabel.toLowerCase()} labels column</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={!hideRowActions} onChange={(e) => { setHideRowActions(!e.target.checked); playSound('settingToggle'); }} className="rounded border-slate-300" />
                        <span>Show {rowLabel.toLowerCase()} actions column</span>
                      </label>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Sound</h4>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={soundEnabled} onChange={(e) => { setSoundEnabled(e.target.checked); if (e.target.checked) playSound('settingToggle'); }} className="rounded border-slate-300" />
                        <span>Enable sounds</span>
                      </label>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Display</h4>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={isFullscreen} onChange={() => { toggleFullscreen(); playSound('settingToggle'); }} className="rounded border-slate-300" />
                        <span>Fullscreen (F11)</span>
                      </label>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Warning Behavior</h4>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={autoSelectBlocking} onChange={(e) => { setAutoSelectBlocking(e.target.checked); playSound('settingToggle'); }} className="rounded border-slate-300" />
                          <span>Auto-select blocking {pl(nodeLabel.toLowerCase(), 2)}</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={resizeAllSelected} onChange={(e) => { setResizeAllSelected(e.target.checked); playSound('settingToggle'); }} className="rounded border-slate-300" />
                          <span>Resize all selected {pl(nodeLabel.toLowerCase(), 2)}</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={edgeSettings.weakEdgePrompt !== false} onChange={(e) => { setEdgeSettings(prev => ({ ...prev, weakEdgePrompt: e.target.checked })); playSound('settingToggle'); }} className="rounded border-slate-300" />
                          <span>Ask before blocking weak {pl(edgeLabel.toLowerCase(), 2)}</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 w-24">Warn time:</span>
                          <input type="range" min="100" max="5000" step="100" value={warningDuration} onChange={(e) => setWarningDuration(Number(e.target.value))} className="flex-1" />
                          <span className="text-xs text-slate-500 w-10">{(warningDuration / 1000).toFixed(1)}s</span>
                          <button onClick={() => setWarningDuration(2000)} className="text-[10px] text-blue-600 hover:underline">Reset</button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{pl(edgeLabel, 2)}</h4>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={edgeSettings.showReasons !== false} onChange={(e) => { setEdgeSettings(prev => ({ ...prev, showReasons: e.target.checked })); playSound('settingToggle'); }} className="rounded border-slate-300" />
                          <span>Show reason labels on paths</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={edgeSettings.colorDirectionHighlight !== false} onChange={(e) => { setEdgeSettings(prev => ({ ...prev, colorDirectionHighlight: e.target.checked })); playSound('settingToggle'); }} className="rounded border-slate-300" />
                          <span>Color incoming/outgoing {pl(edgeLabel.toLowerCase(), 2)}</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={!!edgeSettings.hideSuggestions} onChange={(e) => { setEdgeSettings(prev => ({ ...prev, hideSuggestions: e.target.checked })); playSound('settingToggle'); }} className="rounded border-slate-300" />
                          <span>Hide suggestion {pl(edgeLabel.toLowerCase(), 2)}</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={!!edgeSettings.uniformVisuals} onChange={(e) => { setEdgeSettings(prev => ({ ...prev, uniformVisuals: e.target.checked })); playSound('settingToggle'); }} className="rounded border-slate-300" />
                          <span>Uniform line style (ignore weight)</span>
                        </label>
                        <div className="mt-1">
                          <span className="text-[10px] text-slate-500 block mb-1">Show weight types:</span>
                          <div className="flex gap-3">
                            {['strong', 'weak', 'suggestion'].map(w => {
                              const isFiltered = edgeSettings.filterWeights?.length > 0;
                              const isActive = !isFiltered || edgeSettings.filterWeights?.includes(w);
                              return (
                                <label key={w} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => {
                                      setEdgeSettings(prev => {
                                        let current = prev.filterWeights?.length > 0 ? [...prev.filterWeights] : ['strong', 'weak', 'suggestion'];
                                        if (e.target.checked) { if (!current.includes(w)) current.push(w); }
                                        else { current = current.filter(x => x !== w); }
                                        if (current.length >= 3) return { ...prev, filterWeights: [] };
                                        return { ...prev, filterWeights: current };
                                      });
                                      playSound('settingToggle');
                                    }}
                                    className="rounded border-slate-300"
                                  />
                                  <span className={`capitalize ${w === 'strong' ? 'text-red-600' : w === 'weak' ? 'text-amber-600' : 'text-blue-600'}`}>{w}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="text-[10px] text-slate-500 block mb-1">Default weight for new {pl(edgeLabel.toLowerCase(), 2)}:</span>
                          <div className="flex gap-1">
                            {[
                              { value: 'strong', label: 'Strong', color: 'bg-red-100 text-red-800 border-red-300' },
                              { value: 'weak', label: 'Weak', color: 'bg-amber-100 text-amber-800 border-amber-300' },
                              { value: 'suggestion', label: 'Suggestion', color: 'bg-blue-100 text-blue-800 border-blue-300' },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => { setEdgeSettings(prev => ({ ...prev, defaultEdgeWeight: opt.value })); playSound('settingToggle'); }}
                                className={`flex-1 px-2 py-1 text-[10px] rounded-md border font-medium transition ${
                                  edgeSettings.defaultEdgeWeight === opt.value ? `${opt.color} ring-1 ring-offset-1` : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {selectedEdges?.length === 1 && (
                          <button
                            onClick={() => {
                              const edge = selectedEdges[0];
                              const fullEdge = allEdges?.find(e => e.source === edge.source && e.target === edge.target) || edge;
                              setEdgeEditModal({ source: fullEdge.source, target: fullEdge.target, weight: fullEdge.weight || 'strong', reason: fullEdge.reason || '', description: fullEdge.description || '' });
                            }}
                            className="w-full mt-1 px-2 py-1.5 text-xs rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            Edit Selected {edgeLabel}
                          </button>
                        )}
                        {selectedEdges?.length > 1 && (
                          <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                            <p className="text-[10px] text-slate-500 font-medium">{selectedEdges.length} {pl(edgeLabel.toLowerCase(), selectedEdges.length)} selected</p>
                            <div className="flex gap-1">
                              {['strong', 'weak', 'suggestion'].map(w => (
                                <button key={w} onClick={() => { if (onBulkUpdateEdges) onBulkUpdateEdges(selectedEdges, { weight: w }); }} className="flex-1 px-1.5 py-1 text-[10px] rounded border border-slate-200 text-slate-600 hover:bg-slate-50 capitalize transition">{w}</button>
                              ))}
                            </div>
                            <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const reason = e.target.bulkReason?.value?.trim(); if (reason !== undefined && onBulkUpdateEdges) onBulkUpdateEdges(selectedEdges, { reason }); }}>
                              <input name="bulkReason" type="text" placeholder="Set reason for all…" className="flex-1 text-[10px] border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-indigo-400" />
                              <button type="submit" className="px-1.5 py-1 text-[10px] rounded border border-indigo-300 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition">Apply</button>
                            </form>
                            <button onClick={() => onDeleteSelected && onDeleteSelected()} className="w-full px-2 py-1 text-[10px] rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition">Delete All Selected</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ToolbarSection>

        {/* ─── COL 6: Sizing ─── */}
        <ToolbarSection sectionKey="sizing" label="Sizing" icon={<SettingsIcon style={{ fontSize: 14 }} />} width={210} isOpen={openSections.has('sizing')} {...sectionProps}>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 w-12 flex-shrink-0">{columnLabel} W</span>
              <input type="range" min="20" max="100" value={customColumnWidth} onChange={(e) => setCustomColumnWidth(Number(e.target.value))} className="flex-1 h-1" style={{ minWidth: 60 }} />
              <span className="text-[11px] text-slate-500 w-6 text-right tabular-nums">{customColumnWidth}</span>
              <button onClick={() => setCustomColumnWidth(DEFAULT_COLUMNWIDTH)} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 flex-shrink-0 transition" title="Reset">
                <RestoreIcon style={{ fontSize: 12 }} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 w-12 flex-shrink-0">{rowLabel} H</span>
              <input type="range" min="24" max="80" value={customRowHeightNormal} onChange={(e) => setCustomRowHeightNormal(Number(e.target.value))} className="flex-1 h-1" style={{ minWidth: 60 }} />
              <span className="text-[11px] text-slate-500 w-6 text-right tabular-nums">{customRowHeightNormal}</span>
              <button onClick={() => setCustomRowHeightNormal(DEFAULT_ROWHEIGHT_NORMAL)} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 flex-shrink-0 transition" title="Reset">
                <RestoreIcon style={{ fontSize: 12 }} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 w-12 flex-shrink-0">Coll. H</span>
              <input type="range" min="16" max="40" value={customRowHeightSmall} onChange={(e) => setCustomRowHeightSmall(Number(e.target.value))} className="flex-1 h-1" style={{ minWidth: 60 }} />
              <span className="text-[11px] text-slate-500 w-6 text-right tabular-nums">{customRowHeightSmall}</span>
              <button onClick={() => setCustomRowHeightSmall(DEFAULT_ROWHEIGHT_SMALL)} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 flex-shrink-0 transition" title="Reset">
                <RestoreIcon style={{ fontSize: 12 }} />
              </button>
            </div>
          </div>
        </ToolbarSection>

        {/* ─── COL 7: Views + Snapshots ─── */}
        <ToolbarSection sectionKey="views" label="Views" icon={<ViewListIcon style={{ fontSize: 14 }} />} width={175} isOpen={openSections.has('views')} {...sectionProps}>
          <div className="relative">
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setShowViewDropdown(!showViewDropdown); }}
                className={`flex-1 flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition min-w-0 ${
                  showViewDropdown ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ViewListIcon style={{ fontSize: 14 }} />
                <span className="truncate flex-1 text-left">{activeViewName || "Default"}</span>
                {savedViews.length > 0 && <span className="text-[9px] opacity-50">{savedViews.length}</span>}
              </button>
              <button
                onClick={() => { onSaveView(); }}
                disabled={!activeViewId}
                className={`p-1 rounded-md border transition ${
                  activeViewId ? 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100' : 'border-slate-200 text-slate-300 cursor-not-allowed'
                }`}
                title={activeViewId ? `Save "${activeViewName}" (X+S / X+Y)` : 'Select a view to save'}
              >
                <SaveIcon style={{ fontSize: 14 }} />
              </button>
            </div>

            {showViewDropdown && (
              <div className="absolute top-full right-0 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-xl z-50" onClick={(e) => e.stopPropagation()}>
                <div className="p-3 space-y-2">
                  <button
                    onClick={() => { onLoadView(null); setShowViewDropdown(false); }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${!activeViewId ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Default <span className="ml-1 text-[10px] text-slate-400">(built-in)</span>
                  </button>

                  {savedViews.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 space-y-1">
                      {savedViews.map(view => (
                        <div key={view.id} className={`flex items-center gap-1 rounded px-2 py-1.5 transition ${activeViewId === view.id ? 'bg-teal-50' : 'hover:bg-slate-50'}`}>
                          {renamingViewId === view.id ? (
                            <form className="flex-1 flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (renameText.trim()) { onRenameView(view.id, renameText); setRenamingViewId(null); } }}>
                              <input type="text" value={renameText} onChange={(e) => setRenameText(e.target.value)} autoFocus className="flex-1 text-xs border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-teal-400" onBlur={() => setRenamingViewId(null)} onKeyDown={(e) => { if (e.key === 'Escape') setRenamingViewId(null); }} />
                            </form>
                          ) : (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); onSetDefaultView(view.is_default ? null : view.id); }} className={`p-0.5 rounded transition ${view.is_default ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-amber-400'}`} title={view.is_default ? 'Remove as default' : 'Set as default'}>
                                {view.is_default ? <StarIcon style={{ fontSize: 13 }} /> : <StarBorderIcon style={{ fontSize: 13 }} />}
                              </button>
                              <button onClick={() => { onLoadView(view); setShowViewDropdown(false); }} className={`flex-1 text-left text-xs truncate ${activeViewId === view.id ? 'text-teal-700 font-semibold' : 'text-slate-600'}`}>
                                {view.name}
                                {view.is_default && <span className="ml-1 text-[10px] text-amber-500">(default)</span>}
                              </button>
                              {editingShortcutViewId === view.id ? (
                                <input type="text" maxLength={2} autoFocus placeholder="key(s)"
                                  className="w-12 text-center text-[10px] font-mono border border-teal-300 rounded px-0.5 py-0 focus:outline-none focus:border-teal-500"
                                  defaultValue={(viewShortcuts[view.id] || []).join('').toUpperCase()}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Escape') { setEditingShortcutViewId(null); return; }
                                    if (e.key === 'Backspace' || e.key === 'Delete') {
                                      if (!e.target.value) { onUpdateViewShortcut(view.id, null); setEditingShortcutViewId(null); }
                                      return;
                                    }
                                    if (e.key === 'Enter') {
                                      const val = e.target.value.toLowerCase();
                                      if (!val) { onUpdateViewShortcut(view.id, null); }
                                      else {
                                        const keys = val.split('').filter(c => /^[a-z0-9]$/i.test(c)).slice(0, 2);
                                        if (keys.length > 0 && !keys.some(k => ['e', 'd', 'x', 's', 'y'].includes(k))) {
                                          onUpdateViewShortcut(view.id, keys);
                                        }
                                      }
                                      setEditingShortcutViewId(null);
                                      return;
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value.toLowerCase();
                                    if (!val) { onUpdateViewShortcut(view.id, null); }
                                    else {
                                      const keys = val.split('').filter(c => /^[a-z0-9]$/i.test(c)).slice(0, 2);
                                      if (keys.length > 0 && !keys.some(k => ['e', 'd', 'x', 's', 'y'].includes(k))) {
                                        onUpdateViewShortcut(view.id, keys);
                                      }
                                    }
                                    setEditingShortcutViewId(null);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); setEditingShortcutViewId(view.id); }}
                                  className={`px-1 py-0 text-[9px] font-mono rounded border transition ${viewShortcuts[view.id]?.length ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                  title={viewShortcuts[view.id]?.length ? `Shortcut: X → ${viewShortcuts[view.id].map(k => k.toUpperCase()).join(' → ')}` : 'Set shortcut (X + key(s))'}
                                >
                                  {viewShortcuts[view.id]?.length ? `X+${viewShortcuts[view.id].map(k => k.toUpperCase()).join('+')}` : '⌨'}
                                </button>
                              )}
                              <button onClick={() => { setRenamingViewId(view.id); setRenameText(view.name); }} className="p-0.5 text-slate-400 hover:text-slate-600 rounded" title="Rename"><EditIcon style={{ fontSize: 12 }} /></button>
                              {confirmDeleteViewId === view.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => { onDeleteView(view.id); setConfirmDeleteViewId(null); }} className="text-[10px] text-red-600 hover:text-red-700 font-semibold">Yes</button>
                                  <button onClick={() => setConfirmDeleteViewId(null)} className="text-[10px] text-slate-400 hover:text-slate-600">No</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteViewId(view.id)} className="p-0.5 text-slate-400 hover:text-red-500 rounded" title="Delete"><DeleteIcon style={{ fontSize: 12 }} /></button>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isCreatingView ? (
                    <form className="flex items-center gap-1 mt-1" onSubmit={(e) => { e.preventDefault(); if (newViewName.trim()) { onCreateView(newViewName); setNewViewName(""); setIsCreatingView(false); setShowViewDropdown(false); } }}>
                      <input type="text" value={newViewName} onChange={(e) => setNewViewName(e.target.value)} placeholder="View name…" autoFocus className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-teal-400" onKeyDown={(e) => { if (e.key === 'Escape') { setIsCreatingView(false); setNewViewName(""); } }} />
                      <button type="submit" disabled={!newViewName.trim()} className="px-2 py-1 text-xs rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 transition">Create</button>
                    </form>
                  ) : (
                    <button onClick={() => setIsCreatingView(true)} className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs rounded-lg border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition mt-1">
                      <AddIcon style={{ fontSize: 13 }} /><span>New View</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Snapshots (stacked below views) */}
          <div className="relative mt-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSnapshotDropdown(!showSnapshotDropdown); }}
              className={`w-full flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition ${
                showSnapshotDropdown ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CameraAltIcon style={{ fontSize: 14 }} />
              <span className="flex-1 text-left truncate">Snapshots</span>
              {snapshots.length > 0 && <span className="text-[9px] opacity-50">{snapshots.length}</span>}
            </button>

            {showSnapshotDropdown && (
              <div className="absolute top-full right-0 mt-1 w-80 rounded-lg border border-slate-200 bg-white shadow-xl z-50" onClick={(e) => e.stopPropagation()}>
                <div className="p-3 space-y-2">
                  <p className="text-[10px] text-slate-400 leading-tight">Full project state backup. Restore to revert all data.</p>

                  {snapshots.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 space-y-1 max-h-64 overflow-y-auto">
                      {snapshots.map(snap => (
                        <div key={snap.id} className="rounded px-2 py-1.5 hover:bg-slate-50 transition group">
                          {renamingSnapshotId === snap.id ? (
                            <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (renameSnapshotText.trim()) { onRenameSnapshot(snap.id, renameSnapshotText); setRenamingSnapshotId(null); } }}>
                              <input type="text" value={renameSnapshotText} onChange={(e) => setRenameSnapshotText(e.target.value)} autoFocus className="flex-1 text-xs border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-400" onBlur={() => setRenamingSnapshotId(null)} onKeyDown={(e) => { if (e.key === 'Escape') setRenamingSnapshotId(null); }} />
                            </form>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-slate-700 font-medium truncate">{snap.name}</div>
                                <div className="text-[10px] text-slate-400">
                                  {new Date(snap.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                  {' '}
                                  {new Date(snap.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              {confirmRestoreId === snap.id ? (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className="text-[10px] text-amber-600 font-semibold">Restore?</span>
                                  <button onClick={() => { onRestoreSnapshot(snap.id); setConfirmRestoreId(null); setShowSnapshotDropdown(false); }} className="text-[10px] text-amber-700 hover:text-amber-800 font-bold">Yes</button>
                                  <button onClick={() => setConfirmRestoreId(null)} className="text-[10px] text-slate-400 hover:text-slate-600">No</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmRestoreId(snap.id)} className="p-0.5 text-slate-400 hover:text-amber-600 rounded opacity-0 group-hover:opacity-100 transition" title="Restore"><RestoreIcon style={{ fontSize: 13 }} /></button>
                              )}
                              <button onClick={() => { setRenamingSnapshotId(snap.id); setRenameSnapshotText(snap.name); }} className="p-0.5 text-slate-400 hover:text-slate-600 rounded opacity-0 group-hover:opacity-100 transition" title="Rename"><EditIcon style={{ fontSize: 12 }} /></button>
                              {confirmDeleteSnapshotId === snap.id ? (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button onClick={() => { onDeleteSnapshot(snap.id); setConfirmDeleteSnapshotId(null); }} className="text-[10px] text-red-600 hover:text-red-700 font-semibold">Yes</button>
                                  <button onClick={() => setConfirmDeleteSnapshotId(null)} className="text-[10px] text-slate-400 hover:text-slate-600">No</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteSnapshotId(snap.id)} className="p-0.5 text-slate-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition" title="Delete"><DeleteIcon style={{ fontSize: 12 }} /></button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isCreatingSnapshot ? (
                    <form className="space-y-1.5 mt-1" onSubmit={(e) => { e.preventDefault(); if (newSnapshotName.trim()) { onCreateSnapshot(newSnapshotName.trim(), newSnapshotDesc.trim()); setNewSnapshotName(""); setNewSnapshotDesc(""); setIsCreatingSnapshot(false); setShowSnapshotDropdown(false); } }}>
                      <input type="text" value={newSnapshotName} onChange={(e) => setNewSnapshotName(e.target.value)} placeholder="Snapshot name…" autoFocus className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-amber-400" onKeyDown={(e) => { if (e.key === 'Escape') { setIsCreatingSnapshot(false); setNewSnapshotName(""); setNewSnapshotDesc(""); } }} />
                      <input type="text" value={newSnapshotDesc} onChange={(e) => setNewSnapshotDesc(e.target.value)} placeholder="Description (optional)…" className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-amber-400" />
                      <div className="flex items-center gap-1">
                        <button type="submit" disabled={!newSnapshotName.trim() || snapshotsLoading} className="px-2 py-1 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 transition">{snapshotsLoading ? 'Saving…' : 'Save'}</button>
                        <button type="button" onClick={() => { setIsCreatingSnapshot(false); setNewSnapshotName(""); setNewSnapshotDesc(""); }} className="px-2 py-1 text-xs rounded text-slate-500 hover:text-slate-700 transition">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setIsCreatingSnapshot(true)} disabled={snapshotsLoading} className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs rounded-lg border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition mt-1 disabled:opacity-40">
                      <CameraAltIcon style={{ fontSize: 13 }} /><span>{snapshotsLoading ? 'Creating…' : 'New Snapshot'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </ToolbarSection>
      </div>
    </div>

    {/* ─── Shortcuts Modal ─── */}
    {showShortcutsModal && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 modal-backdrop-animate" onClick={() => setShowShortcutsModal(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[85vh] flex flex-col modal-animate-in" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Keyboard Shortcuts</h2>
              <p className="text-xs text-slate-500 mt-1">Direct shortcuts and customizable Q → W → key combos.</p>
            </div>
            <button onClick={() => setShowShortcutsModal(false)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
              <CloseIcon style={{ fontSize: 20 }} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
            {/* ── Section 1: Fixed shortcuts (read-only) ── */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Direct Shortcuts</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  { keys: 'E', label: 'Schedule Mode' },
                  { keys: 'D', label: `${edgeLabel} Mode` },
                  { keys: 'V', label: 'Inspection Mode' },
                  { keys: 'R', label: 'Refactor Mode' },
                  { keys: 'S', label: 'Toggle Toolbar' },
                  { keys: 'H', label: 'Toggle Header' },
                  { keys: 'F', label: 'Focus Mode' },
                  { keys: 'Del / Backspace', label: 'Delete Selected' },
                  { keys: 'Escape', label: 'Deselect All' },
                  { keys: 'Ctrl + C', label: 'Copy' },
                  { keys: 'Ctrl + V', label: 'Paste' },
                  { keys: 'Ctrl + Z', label: 'Undo' },
                  { keys: 'Ctrl + M', label: `Select All ${pl(nodeLabel, 2)}` },
                  { keys: 'Ctrl + D', label: `Select All ${pl(edgeLabel, 2)}` },
                  { keys: 'Ctrl+Shift+M', label: `Select Visible ${pl(nodeLabel, 2)}` },
                  { keys: 'Ctrl+Shift+D', label: `Select Visible ${pl(edgeLabel, 2)}` },
                  { keys: '← →', label: `Move ${nodeLabel} Left/Right` },
                  { keys: '↑ ↓', label: `Move to ${rowLabel} Above/Below (R)` },
                  { keys: 'Alt + Resize', label: 'Cascade Push Blocking' },
                  { keys: '+', label: 'Spread Selected (1-gap)' },
                  { keys: 'Q→W→E→R', label: 'Quick-Save Snapshot' },
                ].map(s => (
                  <div key={s.keys} className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-50">
                    <span className="text-xs text-slate-600">{s.label}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200">{s.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 2: View shortcuts (read-only) ── */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">View Shortcuts</h3>
              <div className="space-y-1">
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-50">
                  <span className="text-xs text-slate-600">Save current view</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200">X → S</kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-50">
                  <span className="text-xs text-slate-600">Load default view</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200">X → D</kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-50">
                  <span className="text-xs text-slate-600">Load view by shortcut</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200">X → key (→ key₂)</kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-50">
                  <span className="text-xs text-slate-600">Next view</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200">X → →</kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-50">
                  <span className="text-xs text-slate-600">Previous view</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200">X → ←</kbd>
                </div>
                {savedViews.filter(v => viewShortcuts[v.id]?.length).map(v => (
                  <div key={v.id} className="flex items-center justify-between py-1 px-2 rounded bg-blue-50/50 ml-4">
                    <span className="text-xs text-slate-500">{v.name}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-mono text-[10px] border border-blue-200">X → {viewShortcuts[v.id].map(k => k.toUpperCase()).join(' → ')}</kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Section 3: Customizable Q+W shortcuts ── */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Customizable Shortcuts</h3>
              <p className="text-[11px] text-blue-600 font-medium mb-2">
                Press <kbd className="px-1 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px]">Q</kbd> then <kbd className="px-1 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px]">W</kbd> then your key below.
              </p>
              <div className="space-y-0.5">
                {[
                  { key: 'columnWidthUp', label: `${columnLabel} Width +`, description: `Increase ${columnLabel.toLowerCase()} width` },
                  { key: 'columnWidthDown', label: `${columnLabel} Width −`, description: `Decrease ${columnLabel.toLowerCase()} width` },
                  { key: 'rowHeightUp', label: `${rowLabel} Height +`, description: `Increase normal ${rowLabel.toLowerCase()} height` },
                  { key: 'rowHeightDown', label: `${rowLabel} Height −`, description: `Decrease normal ${rowLabel.toLowerCase()} height` },
                  { key: 'rowHeightSmallUp', label: `Small ${rowLabel} Height +`, description: `Increase small ${rowLabel.toLowerCase()} height` },
                  { key: 'rowHeightSmallDown', label: `Small ${rowLabel} Height −`, description: `Decrease small ${rowLabel.toLowerCase()} height` },
                  { key: 'toggleColumnHeader', label: `Toggle ${columnLabel} Header`, description: `Show/hide the ${columnLabel.toLowerCase()} header row` },
                  { key: 'toggleSound', label: 'Toggle Sound', description: 'Enable/disable UI sounds' },
                  { key: 'toggleFullscreen', label: 'Toggle Fullscreen', description: 'Enter/exit fullscreen' },
                  { key: 'toggleEmptyLanes', label: `Toggle Empty ${pl(laneLabel, 2)}`, description: `Show/hide ${pl(laneLabel.toLowerCase(), 2)} with no ${pl(nodeLabel.toLowerCase(), 2)}` },
                  { key: 'togglePhaseColors', label: 'Toggle Phase Colors', description: 'Show/hide phase colors in grid' },
                  { key: 'toggleAllEdges', label: `Toggle All ${pl(edgeLabel, 2)}`, description: `Show/hide all ${edgeLabel.toLowerCase()} lines` },
                  { key: 'toggleCollapsedEdges', label: `Toggle Collapsed ${pl(edgeLabel, 2)}`, description: `Show/hide ${pl(edgeLabel.toLowerCase(), 2)} on collapsed ${pl(laneLabel.toLowerCase(), 2)}` },
                  { key: 'toggleCollapsedNodes', label: `Toggle Collapsed ${pl(nodeLabel, 2)}`, description: `Show/hide ${pl(nodeLabel.toLowerCase(), 2)} on collapsed ${pl(laneLabel.toLowerCase(), 2)}` },
                  { key: 'toggleExpandedRow', label: 'Toggle Gantt View', description: `Expanded ${rowLabel.toLowerCase()} / Gantt view` },
                  { key: 'toggleGlobalPhases', label: 'Toggle Global Phases', description: 'Show/hide global phase header' },
                  { key: 'toggleAutoSelect', label: 'Toggle Auto-Select', description: `Auto-select blocking ${pl(nodeLabel.toLowerCase(), 2)}` },
                  { key: 'collapseAllLanes', label: `Collapse All ${pl(laneLabel, 2)}`, description: `Collapse every ${laneLabel.toLowerCase()}` },
                  { key: 'expandAllLanes', label: `Expand All ${pl(laneLabel, 2)}`, description: `Expand every ${laneLabel.toLowerCase()}` },
                  { key: 'allRowsSmall', label: `All ${pl(rowLabel, 2)} Small`, description: `Set all ${pl(rowLabel.toLowerCase(), 2)} to small size` },
                  { key: 'allRowsNormal', label: `All ${pl(rowLabel, 2)} Normal`, description: `Set all ${pl(rowLabel.toLowerCase(), 2)} to normal size` },
                  { key: 'uncollapseAllColumns', label: `Uncollapse All ${pl(columnLabel, 2)}`, description: `Expand all collapsed ${pl(columnLabel.toLowerCase(), 2)}` },
                  { key: 'selectAllNodes', label: `Select All ${pl(nodeLabel, 2)}`, description: `Select every ${nodeLabel.toLowerCase()}` },
                  { key: 'selectAllEdges', label: `Select All ${pl(edgeLabel, 2)}`, description: `Select every ${edgeLabel.toLowerCase()}` },
                  { key: 'selectVisibleNodes', label: `Select Visible ${pl(nodeLabel, 2)}`, description: `Select displayed ${pl(nodeLabel.toLowerCase(), 2)} only` },
                  { key: 'selectVisibleEdges', label: `Select Visible ${pl(edgeLabel, 2)}`, description: `Select displayed ${pl(edgeLabel.toLowerCase(), 2)} only` },
                  { key: 'createLane', label: `Create ${laneLabel}`, description: `Open create ${laneLabel.toLowerCase()} dialog` },
                  { key: 'createRow', label: `Create ${rowLabel}`, description: `Open create ${rowLabel.toLowerCase()} dialog` },
                  { key: 'createPhase', label: 'Create Phase', description: 'Open create phase dialog' },
                  { key: 'loadDefaultView', label: 'Load Default View', description: 'Switch to the default view' },
                ].map(action => {
                  const currentKey = editingShortcuts[action.key] || '';
                  return (
                    <div key={action.key} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 group">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-700">{action.label}</div>
                        <div className="text-[10px] text-slate-400">{action.description}</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[9px] text-slate-400 font-mono">Q→W→</span>
                        <input
                          type="text"
                          maxLength={1}
                          value={currentKey}
                          placeholder="·"
                          onChange={(e) => {
                            const val = e.target.value.toLowerCase().slice(-1);
                            setEditingShortcuts(prev => ({ ...prev, [action.key]: val }));
                          }}
                          className="w-8 h-7 text-center text-xs font-mono font-bold border border-slate-300 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 uppercase"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
            <button
              onClick={() => setEditingShortcuts({})}
              className="text-xs text-slate-500 hover:text-slate-700 transition"
            >
              Reset All
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="px-3 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onSaveShortcuts) onSaveShortcuts(editingShortcuts);
                  setShowShortcutsModal(false);
                  playSound('settingToggle');
                }}
                className="px-4 py-1.5 text-xs rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
