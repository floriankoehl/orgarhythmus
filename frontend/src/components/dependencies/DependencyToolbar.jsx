import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SettingsIcon from '@mui/icons-material/Settings';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FlagIcon from '@mui/icons-material/Flag';
import FilterListIcon from '@mui/icons-material/FilterList';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import BuildIcon from '@mui/icons-material/Build';

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
}) {
  const hasSelection = selectedMilestones?.size > 0 || selectedConnection;
  
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
      </div>
    </div>
  );
}