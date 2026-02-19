/**
 * Custom hook for managing dependency view display settings
 * 
 * Consolidates all display-related state into a single hook to reduce
 * clutter in the main Dependencies component.
 */

import { useState } from 'react';
import {
  DEFAULT_DEP_SETTINGS,
  DEFAULT_HIDE_GLOBAL_PHASES,
  DEFAULT_TOOLBAR_COLLAPSED,
} from './viewDefaults';
import {
  DEFAULT_TASKHEIGHT_NORMAL,
  DEFAULT_TASKHEIGHT_SMALL,
  DEFAULT_DAYWIDTH,
  TASKWIDTH as DEFAULT_TASKWIDTH_CONSTANT,
  TEAMWIDTH as DEFAULT_TEAMWIDTH_CONSTANT,
} from './layoutMath';

export function useDisplaySettings() {
  // Advanced visual settings
  const [hideCollapsedDependencies, setHideCollapsedDependencies] = useState(false);
  const [hideCollapsedMilestones, setHideCollapsedMilestones] = useState(false);
  const [hideAllDependencies, setHideAllDependencies] = useState(false);
  const [showEmptyTeams, setShowEmptyTeams] = useState(true);
  const [expandedTaskView, setExpandedTaskView] = useState(false);
  const [showPhaseColorsInGrid, setShowPhaseColorsInGrid] = useState(true);
  
  // Dependency display settings
  const [depSettings, setDepSettings] = useState({ ...DEFAULT_DEP_SETTINGS });
  
  // Layout dimensions
  const [customDayWidth, setCustomDayWidth] = useState(DEFAULT_DAYWIDTH);
  const [customTaskHeightNormal, setCustomTaskHeightNormal] = useState(DEFAULT_TASKHEIGHT_NORMAL);
  const [customTaskHeightSmall, setCustomTaskHeightSmall] = useState(DEFAULT_TASKHEIGHT_SMALL);
  const [teamColumnWidth, setTeamColumnWidth] = useState(DEFAULT_TEAMWIDTH_CONSTANT);
  const [taskColumnWidth, setTaskColumnWidth] = useState(DEFAULT_TASKWIDTH_CONSTANT);
  
  // Layout visibility
  const [hideGlobalPhases, setHideGlobalPhases] = useState(DEFAULT_HIDE_GLOBAL_PHASES);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(DEFAULT_TOOLBAR_COLLAPSED);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [hideDayHeader, setHideDayHeader] = useState(false);
  
  // UI preferences
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  
  // Dropdown visibility states
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [openTeamSettings, setOpenTeamSettings] = useState(null);
  
  return {
    // Advanced visual settings
    hideCollapsedDependencies,
    setHideCollapsedDependencies,
    hideCollapsedMilestones,
    setHideCollapsedMilestones,
    hideAllDependencies,
    setHideAllDependencies,
    showEmptyTeams,
    setShowEmptyTeams,
    expandedTaskView,
    setExpandedTaskView,
    showPhaseColorsInGrid,
    setShowPhaseColorsInGrid,
    
    // Dependency settings
    depSettings,
    setDepSettings,
    
    // Layout dimensions
    customDayWidth,
    setCustomDayWidth,
    customTaskHeightNormal,
    setCustomTaskHeightNormal,
    customTaskHeightSmall,
    setCustomTaskHeightSmall,
    teamColumnWidth,
    setTeamColumnWidth,
    taskColumnWidth,
    setTaskColumnWidth,
    
    // Layout visibility
    hideGlobalPhases,
    setHideGlobalPhases,
    toolbarCollapsed,
    setToolbarCollapsed,
    headerCollapsed,
    setHeaderCollapsed,
    hideDayHeader,
    setHideDayHeader,
    
    // UI preferences
    soundEnabled,
    setSoundEnabled,
    isFullscreen,
    setIsFullscreen,
    
    // Dropdown visibility
    showSettingsDropdown,
    setShowSettingsDropdown,
    showFilterDropdown,
    setShowFilterDropdown,
    openTeamSettings,
    setOpenTeamSettings,
  };
}
