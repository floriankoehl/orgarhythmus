import { useState } from 'react';
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

import {
  DEFAULT_TASKHEIGHT_NORMAL,
  DEFAULT_TASKHEIGHT_SMALL,
  DEFAULT_DAYWIDTH,
} from '../../pages/dependency/layoutMath';

export default function DependencyToolbar({
  // Data
  teamOrder,
  teams,
  // Filter state
  teamDisplaySettings,
  setTeamDisplaySettings,
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
  // Warning settings
  warningDuration,
  setWarningDuration,
  // Settings dropdown
  showSettingsDropdown,
  setShowSettingsDropdown,
  // Visibility settings
  hideAllDependencies,
  setHideAllDependencies,
  hideCollapsedDependencies,
  setHideCollapsedDependencies,
  hideCollapsedMilestones,
  setHideCollapsedMilestones,
  showEmptyTeams,
  setShowEmptyTeams,
  // Dimension settings
  customDayWidth,
  setCustomDayWidth,
  customTaskHeightNormal,
  setCustomTaskHeightNormal,
  customTaskHeightSmall,
  setCustomTaskHeightSmall,
  // Create modals
  setShowCreateTeamModal,
  setShowCreateTaskModal,
  setNewTaskTeamId,
  // Milestone adding
  isAddingMilestone,
  setIsAddingMilestone,
  safeMode,
  // Computed values
  hiddenTeamCount,
  // Functions
  isTeamVisible,
  setTeamTasksSmall,
  setTeamTasksNormal,
  showAllHiddenTeams,
  // Selection state for delete
  selectedMilestones,
  selectedConnection,
  // Delete handler
  onDeleteSelected,
  // Refactor mode
  refactorMode,
  setRefactorMode,
  // Expanded task view (Gantt)
  expandedTaskView,
  setExpandedTaskView,
  // Collapse/expand all teams
  collapseAllTeams,
  expandAllTeams,
  // Dependency display settings
  depSettings = {},
  setDepSettings,
  // Connection editing
  connections,
  handleUpdateConnection,
  setConnectionEditModal,
  // Day selection & collapse
  selectedDays,
  collapsedDays,
  collapseSelectedDays,
  uncollapseAll,
  clearDaySelection,
  // Phases
  phases = [],
  setPhaseEditModal,
  // Phase colors in grid
  showPhaseColorsInGrid,
  setShowPhaseColorsInGrid,
  // Team phase row controls
  collapsedTeamPhaseRows,
  collapseAllTeamPhases,
  showAllTeamPhases,
  hideAllTeamPhases,
  teamPhasesMap = {},
  // Views
  savedViews = [],
  activeViewId,
  activeViewName,
  onLoadView,
  onSaveView,
  onCreateView,
  onRenameView,
  onDeleteView,
}) {
  const hasSelection = selectedMilestones?.size > 0 || selectedConnection;

  // ── View UI state ──
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [isCreatingView, setIsCreatingView] = useState(false);
  const [renamingViewId, setRenamingViewId] = useState(null);
  const [renameText, setRenameText] = useState("");
  const [confirmDeleteViewId, setConfirmDeleteViewId] = useState(null);
  
  // Compute how many teams are hidden via teamDisplaySettings
  const filteredTeamCount = teamOrder.filter(tid => teamDisplaySettings[tid]?.hidden).length;
  const allTeamsHidden = filteredTeamCount === teamOrder.length;
  const noTeamsHidden = filteredTeamCount === 0;
  
  const getDeleteLabel = () => {
    if (selectedConnection) return 'Dep';
    if (selectedMilestones?.size > 1) return `${selectedMilestones.size}`;
    if (selectedMilestones?.size === 1) return '1';
    return '';
  };

  const getDeleteTooltip = () => {
    if (selectedConnection) return 'Delete selected dependency';
    if (selectedMilestones?.size > 1) return `Delete ${selectedMilestones.size} milestones`;
    if (selectedMilestones?.size === 1) return 'Delete selected milestone';
    return 'Select milestones or connections to delete';
  };

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex divide-x divide-slate-200">
        
        {/* Section 1: Settings */}
        <div className="p-3 flex-1 min-w-0">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Settings
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Collapse all visible teams
                teamOrder.forEach(tid => {
                  if (isTeamVisible(tid)) setTeamTasksSmall(tid);
                });
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              <UnfoldLessIcon style={{ fontSize: 14 }} />
              <span>Collapse All</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Expand all visible teams
                teamOrder.forEach(tid => {
                  if (isTeamVisible(tid)) setTeamTasksNormal(tid);
                });
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              <UnfoldMoreIcon style={{ fontSize: 14 }} />
              <span>Expand All</span>
            </button>
            {/* Collapse/Expand all teams (fold/unfold team rows) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                collapseAllTeams();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Collapse all teams (hide task rows)"
            >
              <UnfoldLessDoubleIcon style={{ fontSize: 14 }} />
              <span>Fold Teams</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                expandAllTeams();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Expand all teams (show task rows)"
            >
              <UnfoldMoreDoubleIcon style={{ fontSize: 14 }} />
              <span>Unfold Teams</span>
            </button>
            {hiddenTeamCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showAllHiddenTeams();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
              >
                <VisibilityIcon style={{ fontSize: 14 }} />
                <span>Show {hiddenTeamCount} Hidden</span>
              </button>
            )}

            {/* Show All Team Phases (only when some are collapsed) */}
            {(collapsedTeamPhaseRows?.size > 0 || collapseAllTeamPhases) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showAllTeamPhases();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
                title="Show all team phase rows"
              >
                <VisibilityIcon style={{ fontSize: 14 }} />
                <span>Show Team Phases</span>
              </button>
            )}

            {/* Hide All Team Phases (only when there are team phases and not all hidden) */}
            {!collapseAllTeamPhases && Object.values(teamPhasesMap).some(arr => arr?.length > 0) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  hideAllTeamPhases();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                title="Hide all team phase rows"
              >
                <VisibilityOffIcon style={{ fontSize: 14 }} />
                <span>Hide Team Phases</span>
              </button>
            )}
            
            {/* Expanded Task View (Gantt) Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedTaskView(!expandedTaskView);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition ${
                expandedTaskView 
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300' 
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title={expandedTaskView ? "Hide task time spans" : "Show task time spans (Gantt-like)"}
            >
              <ViewTimelineIcon style={{ fontSize: 14 }} />
              <span>Timeline</span>
            </button>

            {/* Settings Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettingsDropdown(!showSettingsDropdown);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition ${
                  showSettingsDropdown 
                    ? 'border-blue-400 bg-blue-50 text-blue-700' 
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <SettingsIcon style={{ fontSize: 14 }} />
                <span>Advanced</span>
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
                        <input
                          type="checkbox"
                          checked={hideAllDependencies}
                          onChange={(e) => setHideAllDependencies(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span>Hide all dependencies</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hideCollapsedDependencies}
                          onChange={(e) => {
                            setHideCollapsedDependencies(e.target.checked);
                            // If unchecking deps, also uncheck milestones since milestones option implies deps
                            if (!e.target.checked) setHideCollapsedMilestones(false);
                          }}
                          className="rounded border-slate-300"
                        />
                        <span>Hide deps for collapsed tasks</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hideCollapsedMilestones}
                          onChange={(e) => {
                            setHideCollapsedMilestones(e.target.checked);
                            // Hiding milestones implies hiding deps too
                            if (e.target.checked) setHideCollapsedDependencies(true);
                          }}
                          className="rounded border-slate-300"
                        />
                        <span>Hide deps &amp; milestones for collapsed tasks</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showEmptyTeams}
                          onChange={(e) => setShowEmptyTeams(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span>Show empty teams</span>
                      </label>
                      {phases.length > 0 && (
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showPhaseColorsInGrid}
                            onChange={(e) => setShowPhaseColorsInGrid?.(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          <span>Show phase colors in grid</span>
                        </label>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Warning Behavior</h4>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoSelectBlocking}
                            onChange={(e) => setAutoSelectBlocking(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          <span>Auto-select blocking milestones</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={depSettings.weakDepPrompt !== false}
                            onChange={(e) => setDepSettings(prev => ({ ...prev, weakDepPrompt: e.target.checked }))}
                            className="rounded border-slate-300"
                          />
                          <span>Ask before blocking weak deps</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 w-24">Warn time:</span>
                          <input
                            type="range"
                            min="100"
                            max="5000"
                            step="100"
                            value={warningDuration}
                            onChange={(e) => setWarningDuration(Number(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-xs text-slate-500 w-10">{(warningDuration / 1000).toFixed(1)}s</span>
                          <button
                            onClick={() => setWarningDuration(2000)}
                            className="text-[10px] text-blue-600 hover:underline"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Dimensions</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 w-24">Day Width:</span>
                          <input
                            type="range"
                            min="20"
                            max="100"
                            value={customDayWidth}
                            onChange={(e) => setCustomDayWidth(Number(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-xs text-slate-500 w-8">{customDayWidth}</span>
                          <button
                            onClick={() => setCustomDayWidth(DEFAULT_DAYWIDTH)}
                            className="text-[10px] text-blue-600 hover:underline"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 w-24">Task Height:</span>
                          <input
                            type="range"
                            min="24"
                            max="80"
                            value={customTaskHeightNormal}
                            onChange={(e) => setCustomTaskHeightNormal(Number(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-xs text-slate-500 w-8">{customTaskHeightNormal}</span>
                          <button
                            onClick={() => setCustomTaskHeightNormal(DEFAULT_TASKHEIGHT_NORMAL)}
                            className="text-[10px] text-blue-600 hover:underline"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 w-24">Collapsed:</span>
                          <input
                            type="range"
                            min="16"
                            max="40"
                            value={customTaskHeightSmall}
                            onChange={(e) => setCustomTaskHeightSmall(Number(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-xs text-slate-500 w-8">{customTaskHeightSmall}</span>
                          <button
                            onClick={() => setCustomTaskHeightSmall(DEFAULT_TASKHEIGHT_SMALL)}
                            className="text-[10px] text-blue-600 hover:underline"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Dependency Display */}
                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Dependencies</h4>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={depSettings.showReasons !== false}
                            onChange={(e) => setDepSettings(prev => ({ ...prev, showReasons: e.target.checked }))}
                            className="rounded border-slate-300"
                          />
                          <span>Show reason labels on paths</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!depSettings.hideSuggestions}
                            onChange={(e) => setDepSettings(prev => ({ ...prev, hideSuggestions: e.target.checked }))}
                            className="rounded border-slate-300"
                          />
                          <span>Hide suggestion dependencies</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!depSettings.uniformVisuals}
                            onChange={(e) => setDepSettings(prev => ({ ...prev, uniformVisuals: e.target.checked }))}
                            className="rounded border-slate-300"
                          />
                          <span>Uniform line style (ignore weight)</span>
                        </label>
                        <div className="mt-1">
                          <span className="text-[10px] text-slate-500 block mb-1">Show weight types:</span>
                          <div className="flex gap-3">
                            {['strong', 'weak', 'suggestion'].map(w => {
                              const active = !depSettings.filterWeights || depSettings.filterWeights.length === 0 || depSettings.filterWeights.includes(w);
                              return (
                                <label key={w} className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={(e) => {
                                      setDepSettings(prev => {
                                        const current = prev.filterWeights && prev.filterWeights.length > 0
                                          ? [...prev.filterWeights]
                                          : ['strong', 'weak', 'suggestion'];
                                        if (e.target.checked) {
                                          if (!current.includes(w)) current.push(w);
                                        } else {
                                          const idx = current.indexOf(w);
                                          if (idx > -1) current.splice(idx, 1);
                                        }
                                        // If all checked, clear filter
                                        if (current.length === 3) return { ...prev, filterWeights: [] };
                                        return { ...prev, filterWeights: current };
                                      });
                                    }}
                                    className="rounded border-slate-300"
                                  />
                                  <span className="capitalize">{w}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        {/* Default weight for new dependencies */}
                        <div className="mt-2">
                          <span className="text-[10px] text-slate-500 block mb-1">Default weight for new connections:</span>
                          <div className="flex gap-1">
                            {[
                              { value: 'strong', label: 'Strong', color: 'bg-red-100 text-red-800 border-red-300' },
                              { value: 'weak', label: 'Weak', color: 'bg-amber-100 text-amber-800 border-amber-300' },
                              { value: 'suggestion', label: 'Suggestion', color: 'bg-blue-100 text-blue-800 border-blue-300' },
                            ].map(opt => {
                              const isActive = (depSettings.defaultDepWeight || 'strong') === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => setDepSettings(prev => ({ ...prev, defaultDepWeight: opt.value }))}
                                  className={`flex-1 px-2 py-1 text-[10px] rounded border transition ${
                                    isActive
                                      ? `${opt.color} ring-1 ring-offset-1 ring-slate-400 font-semibold`
                                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {/* Edit selected connection */}
                        {selectedConnection && (
                          <button
                            onClick={() => {
                              const conn = connections?.find(c => c.source === selectedConnection.source && c.target === selectedConnection.target);
                              if (conn) {
                                setConnectionEditModal({
                                  source: conn.source,
                                  target: conn.target,
                                  weight: conn.weight || 'strong',
                                  reason: conn.reason || '',
                                });
                              }
                            }}
                            className="w-full mt-1 px-2 py-1.5 text-xs rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            Edit Selected Dependency
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Mode */}
        <div className="p-3 flex-1 min-w-0">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Mode
          </h3>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewMode("inspection");
                baseViewModeRef.current = "inspection";
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition ${
                viewMode === "inspection"
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="View only - no data changes (V)"
            >
              <VisibilityIcon style={{ fontSize: 14 }} />
              <span>View</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewMode("schedule");
                baseViewModeRef.current = "schedule";
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition ${
                viewMode === "schedule"
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Edit milestones, schedule and resize (E)"
            >
              <ScheduleIcon style={{ fontSize: 14 }} />
              <span>Edit</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewMode("dependency");
                baseViewModeRef.current = "dependency";
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition ${
                viewMode === "dependency"
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Edit dependency connections (D)"
            >
              <AccountTreeIcon style={{ fontSize: 14 }} />
              <span>Deps</span>
            </button>
          </div>
        </div>

        {/* Section 3: Create & Delete */}
        <div className="p-3 flex-1 min-w-0">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Actions
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCreateTeamModal(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              <GroupAddIcon style={{ fontSize: 14 }} />
              <span>New Team</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const realTeams = teamOrder.filter(tid => !teams[tid]?._virtual);
                if (realTeams.length > 0) {
                  setNewTaskTeamId(realTeams[0]);
                }
                setShowCreateTaskModal(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              disabled={teamOrder.filter(tid => !teams[tid]?._virtual).length === 0}
              title={teamOrder.filter(tid => !teams[tid]?._virtual).length === 0 ? "Create a team first" : "Create a new task"}
            >
              <PlaylistAddIcon style={{ fontSize: 14 }} />
              <span>New Task</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingMilestone(!isAddingMilestone);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition ${
                isAddingMilestone 
                  ? 'border-blue-400 bg-blue-50 text-blue-700' 
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title={isAddingMilestone ? "Click on a task row to place milestone" : "Add a new milestone"}
            >
              <FlagIcon style={{ fontSize: 14 }} />
              <span>Add Milestone</span>
            </button>
            
            {/* Delete Button - compact, always rendered for stable layout */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasSelection) onDeleteSelected();
              }}
              disabled={!hasSelection}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border transition whitespace-nowrap ${
                hasSelection
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-slate-200 text-slate-300 cursor-not-allowed'
              }`}
              title={getDeleteTooltip()}
            >
              <DeleteIcon style={{ fontSize: 14 }} />
              {hasSelection && <span>{getDeleteLabel()}</span>}
            </button>

            {/* Refactor Mode Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRefactorMode(!refactorMode);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition ${
                refactorMode 
                  ? 'border-orange-400 bg-orange-50 text-orange-700 ring-1 ring-orange-300' 
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title={refactorMode ? "Exit refactor mode" : "Enter refactor mode – drag items back to IdeaBin"}
            >
              <BuildIcon style={{ fontSize: 14 }} />
              <span>Refactor</span>
            </button>

            {/* Day Selection / Collapse Controls */}
            {selectedDays?.size > 0 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    collapseSelectedDays?.();
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                  title={`Collapse ${selectedDays.size} selected day(s)`}
                >
                  <UnfoldLessIcon style={{ fontSize: 14 }} />
                  <span>Collapse {selectedDays.size} day{selectedDays.size > 1 ? 's' : ''}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearDaySelection?.();
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 transition"
                  title="Clear day selection"
                >
                  ✕
                </button>
              </>
            )}
            {collapsedDays?.size > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  uncollapseAll?.();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                title={`Expand all ${collapsedDays.size} collapsed day(s)`}
              >
                <UnfoldMoreIcon style={{ fontSize: 14 }} />
                <span>Expand All ({collapsedDays.size})</span>
              </button>
            )}

            {/* Add Phase */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Auto-fill from selected days if any are selected
                let startIdx = 0;
                let dur = 7;
                if (selectedDays?.size > 0) {
                  const sorted = [...selectedDays].sort((a, b) => a - b);
                  startIdx = sorted[0];
                  dur = sorted[sorted.length - 1] - sorted[0] + 1;
                }
                setPhaseEditModal?.({ mode: 'create', start_index: startIdx, duration: dur, name: '', color: '#3b82f6' });
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Add a new phase/timeframe"
            >
              <ViewTimelineIcon style={{ fontSize: 14 }} />
              <span>+ Phase</span>
            </button>
          </div>
          {isAddingMilestone && (
            <p className="text-xs text-blue-600 mt-2">Click on a day cell in any task row to create a milestone there.</p>
          )}
        </div>

        {/* Section 4: Filter */}
        <div className="p-3 flex-shrink-0" style={{ minWidth: '130px' }}>
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Filter
          </h3>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFilterDropdown(!showFilterDropdown);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition ${
                filteredTeamCount > 0
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : showFilterDropdown
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FilterListIcon style={{ fontSize: 14 }} />
              <span>
                {filteredTeamCount > 0 
                  ? `${filteredTeamCount} team${filteredTeamCount > 1 ? 's' : ''} hidden`
                  : 'Filter Teams'
                }
              </span>
            </button>
            
            {showFilterDropdown && (
              <div 
                className="absolute top-full right-0 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-xl z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-medium text-slate-700">Show teams:</span>
                    <div className="flex gap-2">
                      {!noTeamsHidden && (
                        <button
                          onClick={() => {
                            setTeamDisplaySettings(prev => {
                              const updated = { ...prev };
                              for (const tid of teamOrder) {
                                updated[tid] = { ...updated[tid], hidden: false };
                              }
                              return updated;
                            });
                          }}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Select all
                        </button>
                      )}
                      {!allTeamsHidden && (
                        <button
                          onClick={() => {
                            setTeamDisplaySettings(prev => {
                              const updated = { ...prev };
                              for (const tid of teamOrder) {
                                updated[tid] = { ...updated[tid], hidden: true };
                              }
                              return updated;
                            });
                          }}
                          className="text-[10px] text-slate-500 hover:underline"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {teamOrder.map((teamId) => {
                      const team = teams[teamId];
                      if (!team) return null;
                      const isVisible = !teamDisplaySettings[teamId]?.hidden;
                      return (
                        <label
                          key={teamId}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => {
                              setTeamDisplaySettings(prev => ({
                                ...prev,
                                [teamId]: { ...prev[teamId], hidden: !prev[teamId]?.hidden }
                              }));
                            }}
                            className="rounded border-slate-300"
                          />
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="text-xs text-slate-700 truncate">{team.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Views */}
        <div className="p-3 flex-shrink-0" style={{ minWidth: '180px' }}>
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Views
          </h3>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowViewDropdown(!showViewDropdown);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition w-full justify-between ${
                showViewDropdown
                  ? 'border-teal-400 bg-teal-50 text-teal-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <ViewListIcon style={{ fontSize: 14 }} />
                <span className="truncate">{activeViewName || "Default"}</span>
              </div>
              <span className="text-[10px] opacity-60">{savedViews.length > 0 ? `${savedViews.length}` : ''}</span>
            </button>

            {showViewDropdown && (
              <div
                className="absolute top-full right-0 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-xl z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 space-y-2">
                  {/* Default view */}
                  <button
                    onClick={() => {
                      onLoadView(null);
                      setShowViewDropdown(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
                      !activeViewId
                        ? 'bg-teal-50 text-teal-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Default
                    <span className="ml-1 text-[10px] text-slate-400">(unsaved)</span>
                  </button>

                  {/* Saved views */}
                  {savedViews.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 space-y-1">
                      {savedViews.map(view => (
                        <div key={view.id} className={`flex items-center gap-1 rounded px-2 py-1.5 transition ${
                          activeViewId === view.id ? 'bg-teal-50' : 'hover:bg-slate-50'
                        }`}>
                          {/* Rename mode */}
                          {renamingViewId === view.id ? (
                            <form
                              className="flex-1 flex items-center gap-1"
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (renameText.trim()) {
                                  onRenameView(view.id, renameText);
                                  setRenamingViewId(null);
                                }
                              }}
                            >
                              <input
                                type="text"
                                value={renameText}
                                onChange={(e) => setRenameText(e.target.value)}
                                autoFocus
                                className="flex-1 text-xs border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-teal-400"
                                onBlur={() => setRenamingViewId(null)}
                                onKeyDown={(e) => { if (e.key === 'Escape') setRenamingViewId(null); }}
                              />
                            </form>
                          ) : (
                            <>
                              {/* View name - click to load */}
                              <button
                                onClick={() => {
                                  onLoadView(view);
                                  setShowViewDropdown(false);
                                }}
                                className={`flex-1 text-left text-xs truncate ${
                                  activeViewId === view.id ? 'text-teal-700 font-semibold' : 'text-slate-600'
                                }`}
                              >
                                {view.name}
                              </button>
                              {/* Edit (rename) */}
                              <button
                                onClick={() => {
                                  setRenamingViewId(view.id);
                                  setRenameText(view.name);
                                }}
                                className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                                title="Rename view"
                              >
                                <EditIcon style={{ fontSize: 12 }} />
                              </button>
                              {/* Delete */}
                              {confirmDeleteViewId === view.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      onDeleteView(view.id);
                                      setConfirmDeleteViewId(null);
                                    }}
                                    className="text-[10px] text-red-600 hover:text-red-700 font-semibold"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteViewId(null)}
                                    className="text-[10px] text-slate-400 hover:text-slate-600"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteViewId(view.id)}
                                  className="p-0.5 text-slate-400 hover:text-red-500 rounded"
                                  title="Delete view"
                                >
                                  <DeleteIcon style={{ fontSize: 12 }} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Save current view (only when on a saved view) */}
                  {activeViewId && (
                    <button
                      onClick={() => {
                        onSaveView();
                        setShowViewDropdown(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 transition mt-1"
                    >
                      <SaveIcon style={{ fontSize: 13 }} />
                      <span>Save "{activeViewName}"</span>
                    </button>
                  )}

                  {/* Create new view */}
                  {isCreatingView ? (
                    <form
                      className="flex items-center gap-1 mt-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newViewName.trim()) {
                          onCreateView(newViewName);
                          setNewViewName("");
                          setIsCreatingView(false);
                          setShowViewDropdown(false);
                        }
                      }}
                    >
                      <input
                        type="text"
                        value={newViewName}
                        onChange={(e) => setNewViewName(e.target.value)}
                        placeholder="View name…"
                        autoFocus
                        className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-teal-400"
                        onKeyDown={(e) => { if (e.key === 'Escape') { setIsCreatingView(false); setNewViewName(""); } }}
                      />
                      <button
                        type="submit"
                        disabled={!newViewName.trim()}
                        className="px-2 py-1 text-xs rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 transition"
                      >
                        Create
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsCreatingView(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition mt-1"
                    >
                      <AddIcon style={{ fontSize: 13 }} />
                      <span>New View</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}