// ==========================================
// Centralized Sound Registry
// ==========================================
// Change any sound mapping here — no need to touch component files.
//
// Usage:  import { playSound } from '../assets/sound_registry';
//         playSound('milestoneMove');
//
// To swap a sound: just change the import path below.
// To disable a sound: set it to null.
// ==========================================

// -- Static imports (Vite resolves these at build time) --
import selectSound from './dependency/select.wav';
import subtleSound from './dependency/subtle.wav';
import scifiSound from './dependency/scifi.wav';
import rewindSound from './dependency/rewind.wav';
import mixkitClickSound from './dependency/mixkit-sci-fi-click-900.wav';
import messageSound from './dependency/message.wav';
import errorSound from './dependency/error.wav';
import error2Sound from './dependency/error_2.wav';
import connectionDragSound from './dependency/connection_drag.wav';
import connectionSound from './dependency/connection.wav';
import collapseSound from './dependency/collapse.wav';
import snapSound from './snap.mp3';
import clackSound from './clack.mp3';
import penDownSound from './pen_down.mp3';
import whipSound from './whip.mp3';
import whip2Sound from './whip_2.mp3';

// -- New sounds --
import settingToneSound from './new/change_any_setting_tone.mp3';
import refactorModeSound from './new/change_to_refractor_mode.wav';
import changeViewSound from './new/change_view.wav';
import collapseIdeaSound from './new/collapse_idea_container.wav';
import collapseTeamSound from './new/collapse_team.wav';
import deletingSound from './new/deleting_anything.wav';
import phaseDropResizeSound from './new/dropping_and_resizing_phase.wav';
import dropIdeaSound from './new/drop_idea.wav';
import filterTeamSound from './new/filter_for_team.wav';
import phaseAddedSound from './new/phase_added.wav';
import saveViewSound from './new/safe_view.wav';
import taskReorderSound from './new/task_reordering.wav';
import teamReorderSound from './new/team_reordering.wav';

// -- Idea sounds --
import ideaSound from './ideas/idea.wav';
import idea2Sound from './ideas/idea_2.wav';
import ideaConvertSound from './ideas/convert_idea_to_task.wav';
import ideaCoinSound from './ideas/mixkit-space-coin-win-notification-271.wav';
import ideaNotifSound from './ideas/mixkit-quick-positive-video-game-notification-interface-265.wav';

// ==========================================
//  SOUND MAP — edit this to reassign sounds
// ==========================================
// Each key = event name used in code.
// Each value = an imported sound file (or null to disable).
//
const SOUND_FILES = {
  // ── Milestone interactions ──
  milestoneSelect:       selectSound,            // clicking a milestone
  milestoneDeselect:     subtleSound,            // deselecting / escape
  milestoneMove:         snapSound,              // drag-drop milestone to new day
  milestoneResize:       clackSound,             // edge-resize completes
  milestoneCreate:       messageSound,           // new milestone created
  milestoneDelete:       deletingSound,          // milestone removed
  milestoneRename:       penDownSound,           // rename confirmed

  // ── Connection interactions ──
  connectionCreate:      connectionSound,        // dependency line created
  connectionDelete:      deletingSound,          // dependency line removed
  connectionSelect:      selectSound,    // click on a connection
  connectionDragStart:   connectionDragSound,    // start dragging connection handle

  // ── Drag interactions ──
  teamDragDrop:          teamReorderSound,       // team reorder completes
  taskDragDrop:          taskReorderSound,       // task reorder completes
  dragLoop:              connectionDragSound,    // continuous loop while dragging

  // ── Phase interactions ──
  phaseCreate:           phaseAddedSound,        // phase created
  phaseUpdate:           phaseDropResizeSound,   // phase updated / resized
  phaseDelete:           deletingSound,          // phase deleted

  // ── Warnings / blocked actions ──
  warning:               errorSound,             // dependency violation / overlap
  blocked:               error2Sound,            // general blocked action

  // ── View mode changes ──
  modeSwitch:            mixkitClickSound,       // E / D / V mode toggle
  refactorToggle:        refactorModeSound,      // refactor mode on/off

  // ── Settings ──
  settingToggle:         settingToneSound,       // any setting toggled
  teamFilter:            filterTeamSound,        // team filter toggled

  // ── Views & Snapshots ──
  viewLoad:              changeViewSound,        // saved view loaded
  viewSave:              saveViewSound,          // view saved / created
  snapshotRestore:       rewindSound,            // snapshot restored
  undo:                  rewindSound,            // Ctrl+Z undo

  // ── UI feedback ──
  collapse:              collapseTeamSound,      // team collapse / expand
  uiClick:               scifiSound,             // generic UI click

  // ── Multi-select / marquee ──
  marqueeSelect:         subtleSound,            // marquee selection completes

  // ── Idea interactions ──
  ideaCreate:            ideaSound,              // new idea created
  ideaDelete:            deletingSound,          // idea deleted
  ideaDragDrop:          dropIdeaSound,          // idea reorder / category drop
  ideaTransform:         ideaConvertSound,       // idea transformed to task/milestone
  ideaRefactor:          ideaConvertSound,       // dep item refactored back to idea
  ideaCategoryCreate:    ideaNotifSound,         // category created
  ideaCategoryArchive:   subtleSound,            // category archived/unarchived
  ideaCategoryDelete:    deletingSound,          // category deleted
  ideaExternalDrop:      ideaConvertSound,       // idea dropped onto Dependencies
  ideaOpen:              subtleSound,            // IdeaBin window opened
  ideaClose:             collapseIdeaSound,      // IdeaBin window minimized
};

// ==========================================
// Audio Cache (prevents re-creating Audio objects)
// ==========================================
const audioCache = {};

// Global volume (0.0 - 1.0)
let globalVolume = 0.3;

// Global mute flag
let muted = false;

/**
 * Play a sound by its registry key.
 * @param {string} key - One of the keys from SOUND_FILES
 * @param {object} [options] - { volume?: number (0-1), force?: boolean }
 */
export function playSound(key, options = {}) {
  if (muted && !options.force) return;

  const src = SOUND_FILES[key];
  if (!src) {
    // null means intentionally disabled — only warn for truly unknown keys
    if (src === undefined) console.warn(`[sounds] Unknown sound key: "${key}"`);
    return;
  }

  try {
    // Create a fresh Audio each time for overlapping playback support
    if (!audioCache[key]) {
      audioCache[key] = new Audio(src);
    }
    const audio = audioCache[key];
    audio.volume = options.volume ?? globalVolume;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Browser may block autoplay — silently ignore
    });
  } catch (e) {
    // Audio not supported or file missing — fail silently
  }
}

/**
 * Set global volume for all sounds.
 * @param {number} v - 0.0 to 1.0
 */
export function setSoundVolume(v) {
  globalVolume = Math.max(0, Math.min(1, v));
  // Update existing cached audio elements
  for (const audio of Object.values(audioCache)) {
    audio.volume = globalVolume;
  }
}

/**
 * Get current global volume.
 */
export function getSoundVolume() {
  return globalVolume;
}

/**
 * Mute / unmute all sounds.
 */
export function setMuted(val) {
  muted = !!val;
}

export function isMuted() {
  return muted;
}

/**
 * Preload specific sounds (call on mount to avoid delay on first play).
 * @param {string[]} keys - Array of sound keys to preload
 */
export function preloadSounds(keys) {
  for (const key of keys) {
    const src = SOUND_FILES[key];
    if (src && !audioCache[key]) {
      audioCache[key] = new Audio(src);
      audioCache[key].preload = 'auto';
    }
  }
}

/**
 * Get all available sound keys (useful for settings UI).
 */
export function getSoundKeys() {
  return Object.keys(SOUND_FILES);
}

/**
 * Get the file path for a sound key (useful for debugging).
 */
export function getSoundPath(key) {
  return SOUND_FILES[key] || null;
}

// ==========================================
// Looping Sound Support (for continuous drag sounds)
// ==========================================
const loopingAudios = {};

/**
 * Start playing a sound in a continuous loop.
 * Does nothing if already looping for this key.
 * @param {string} key - One of the keys from SOUND_FILES
 * @param {object} [options] - { volume?: number (0-1) }
 */
export function startLoopSound(key, options = {}) {
  if (muted) return;
  if (loopingAudios[key]) return; // already playing

  const src = SOUND_FILES[key];
  if (!src) return;

  try {
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = options.volume ?? globalVolume * 0.4;
    audio.play().catch(() => {});
    loopingAudios[key] = audio;
  } catch (e) {
    // fail silently
  }
}

/**
 * Stop a looping sound started with startLoopSound.
 * @param {string} key
 */
export function stopLoopSound(key) {
  const audio = loopingAudios[key];
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    delete loopingAudios[key];
  }
}