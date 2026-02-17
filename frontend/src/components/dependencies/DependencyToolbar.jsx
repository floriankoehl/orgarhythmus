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
  teamFilter,
  setTeamFilter,
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
}) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-4 divide-x divide-slate-200">
        
        {/* Section 1: Settings */}
        <div className="p-3">
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
              >
                <VisibilityIcon style={{ fontSize: 14 }} />
                <span>Show {hiddenTeamCount} Hidden</span>
              </button>
            )}
            
            {/* Advanced Settings Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettingsDropdown(!showSettingsDropdown);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition ${
                  showSettingsDropdown 
                    ? 'border-blue-300 bg-blue-50 text-blue-700' 
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <SettingsIcon style={{ fontSize: 14 }} />
                <span>More</span>
              </button>
              
              {showSettingsDropdown && (
                <div 
                  className="absolute left-0 top-full mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-xl z-[1000]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-3">
                    {/* Visibility options */}
                    <div>
                      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Visibility</h4>
                      <div className="space-y-2">
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
                            onChange={(e) => setHideCollapsedDependencies(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          <span>Hide dependencies for collapsed tasks</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hideCollapsedMilestones}
                            onChange={(e) => setHideCollapsedMilestones(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          <span>Hide milestones for collapsed tasks</span>
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
                    </div>
                    
                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Dimensions</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-600">Day width</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="30"
                              max="120"
                              value={customDayWidth}
                              onChange={(e) => setCustomDayWidth(Math.max(30, Math.min(120, parseInt(e.target.value) || DEFAULT_DAYWIDTH)))}
                              className="w-16 px-2 py-1 text-xs border border-slate-200 rounded text-right"
                            />
                            <span className="text-xs text-slate-400">px</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-600">Task height (normal)</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="20"
                              max="60"
                              value={customTaskHeightNormal}
                              onChange={(e) => setCustomTaskHeightNormal(Math.max(20, Math.min(60, parseInt(e.target.value) || DEFAULT_TASKHEIGHT_NORMAL)))}
                              className="w-16 px-2 py-1 text-xs border border-slate-200 rounded text-right"
                            />
                            <span className="text-xs text-slate-400">px</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-600">Task height (collapsed)</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="14"
                              max="40"
                              value={customTaskHeightSmall}
                              onChange={(e) => setCustomTaskHeightSmall(Math.max(14, Math.min(40, parseInt(e.target.value) || DEFAULT_TASKHEIGHT_SMALL)))}
                              className="w-16 px-2 py-1 text-xs border border-slate-200 rounded text-right"
                            />
                            <span className="text-xs text-slate-400">px</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setCustomDayWidth(DEFAULT_DAYWIDTH);
                            setCustomTaskHeightNormal(DEFAULT_TASKHEIGHT_NORMAL);
                            setCustomTaskHeightSmall(DEFAULT_TASKHEIGHT_SMALL);
                          }}
                          className="w-full mt-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition"
                        >
                          Reset to defaults
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Mode Toggle */}
        <div className="p-3">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Mode {mode === "duration" && <span className="text-blue-500">(Shift held)</span>}
            {mode === "connect" && <span className="text-purple-500">(Alt held)</span>}
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
              title="View only - no data changes"
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
              title="Move and schedule milestones"
            >
              <ScheduleIcon style={{ fontSize: 14 }} />
              <span>Sched</span>
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
              title="Edit dependency connections (Alt)"
            >
              <AccountTreeIcon style={{ fontSize: 14 }} />
              <span>Deps</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewMode("milestone");
                baseViewModeRef.current = "milestone";
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition ${
                viewMode === "milestone"
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Edit milestones (Shift)"
            >
              <FlagIcon style={{ fontSize: 14 }} />
              <span>Miles</span>
            </button>
          </div>
          
          {/* Auto-select blocking milestone toggle */}
          <label 
            className="flex items-center gap-2 mt-3 cursor-pointer group"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={autoSelectBlocking}
              onChange={(e) => setAutoSelectBlocking(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-600 group-hover:text-slate-800">
              Auto-select blocking milestone
            </span>
          </label>
        </div>

        {/* Section 3: Filter */}
        <div className="p-3">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Team Filter
          </h3>
          <div className="relative" data-filter-dropdown>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFilterDropdown(!showFilterDropdown);
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg border transition ${
                teamFilter.length > 0
                  ? 'border-blue-300 bg-blue-50 text-blue-700' 
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FilterListIcon style={{ fontSize: 14 }} />
              <span className="flex-1 text-left">
                {teamFilter.length === 0 
                  ? 'All Teams' 
                  : `${teamFilter.length} team${teamFilter.length > 1 ? 's' : ''} selected`}
              </span>
              {teamFilter.length > 0 && (
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    setTeamFilter([]);
                  }}
                  className="text-blue-500 hover:text-blue-700"
                >
                  ✕
                </span>
              )}
            </button>
            
            {/* Team Filter Dropdown */}
            {showFilterDropdown && (
              <div 
                className="absolute left-0 top-full mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl z-[1000]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    Select Teams
                  </span>
                  {teamFilter.length > 0 && (
                    <button
                      onClick={() => setTeamFilter([])}
                      className="text-[10px] text-blue-600 hover:text-blue-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {teamOrder.map((teamId) => {
                    const team = teams[teamId];
                    if (!team) return null;
                    const isInFilter = teamFilter.includes(teamId);
                    const isVisible = teamFilter.length === 0 || isInFilter;
                    
                    return (
                      <button
                        key={teamId}
                        onClick={() => {
                          if (teamFilter.length === 0) {
                            setTeamFilter([teamId]);
                          } else if (isInFilter) {
                            const newFilter = teamFilter.filter(id => id !== teamId);
                            setTeamFilter(newFilter);
                          } else {
                            setTeamFilter([...teamFilter, teamId]);
                          }
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition text-left ${
                          isVisible 
                            ? 'bg-slate-50 text-slate-900' 
                            : 'text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="truncate flex-1">{team.name}</span>
                        {isInFilter && (
                          <span className="text-blue-600 text-[10px]">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {teamOrder.length === 0 && (
                  <p className="text-xs text-slate-400 italic px-2 py-1">No teams</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Create */}
        <div className="p-3">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Create
          </h3>
          <div className="flex gap-2">
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
                if (teamOrder.length > 0) {
                  setNewTaskTeamId(teamOrder[0]);
                }
                setShowCreateTaskModal(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              disabled={teamOrder.length === 0}
              title={teamOrder.length === 0 ? "Create a team first" : "Create a new task"}
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
              disabled={safeMode}
              title={isAddingMilestone ? "Click on a task row to place milestone" : "Add a new milestone"}
            >
              <FlagIcon style={{ fontSize: 14 }} />
              <span>Add Milestone</span>
            </button>
          </div>
          {isAddingMilestone && (
            <p className="text-xs text-blue-600 mt-2">Click on a day cell in any task row to create a milestone there.</p>
          )}
        </div>
      </div>
    </div>
  );
}