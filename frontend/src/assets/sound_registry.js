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
  milestoneDelete:       rewindSound,            // milestone removed
  milestoneRename:       penDownSound,           // rename confirmed

  // ── Connection interactions ──
  connectionCreate:      connectionSound,        // dependency line created
  connectionDelete:      rewindSound,            // dependency line removed
  connectionSelect:      connectionDragSound,    // click on a connection
  connectionDragStart:   connectionDragSound,    // start dragging connection handle

  // ── Drag interactions ──
  teamDragDrop:          whipSound,              // team reorder completes
  taskDragDrop:          whip2Sound,             // task reorder completes

  // ── Warnings / blocked actions ──
  warning:               errorSound,             // dependency violation / overlap
  blocked:               error2Sound,            // general blocked action

  // ── View mode changes ──
  modeSwitch:            mixkitClickSound,       // E / D / V mode toggle

  // ── UI feedback ──
  collapse:              collapseSound,          // team collapse / expand
  uiClick:               scifiSound,             // generic UI click

  // ── Multi-select / marquee ──
  marqueeSelect:         subtleSound,            // marquee selection completes

  // ── Idea interactions ──
  ideaCreate:            ideaSound,              // new idea created
  ideaDelete:            rewindSound,            // idea deleted
  ideaDragDrop:          idea2Sound,             // idea reorder / category drop
  ideaTransform:         ideaConvertSound,       // idea transformed to task/milestone
  ideaRefactor:          ideaCoinSound,          // dep item refactored back to idea
  ideaCategoryCreate:    ideaNotifSound,         // category created
  ideaCategoryArchive:   subtleSound,            // category archived/unarchived
  ideaCategoryDelete:    rewindSound,            // category deleted
  ideaExternalDrop:      ideaConvertSound,       // idea dropped onto Dependencies
  ideaOpen:              subtleSound,            // IdeaBin window opened
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