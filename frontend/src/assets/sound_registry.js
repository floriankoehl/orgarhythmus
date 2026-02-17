// ==========================================
// Centralized Sound Registry
// ==========================================
// Change any sound mapping here — no need to touch component files.
//
// Usage:  import { playSound } from '../config/sounds';
//         playSound('milestoneMove');
// ==========================================

// -- Import all dependency sound files --
// Update these paths to match your actual asset filenames in /public/sounds/ or /src/assets/sounds/
const SOUND_FILES = {
  // Milestone interactions
  milestoneSelect:       '/sounds/dependency/milestone_select.mp3',
  milestoneDeselect:     '/sounds/dependency/milestone_deselect.mp3',
  milestoneMove:         '/sounds/dependency/milestone_move.mp3',
  milestoneResize:       '/sounds/dependency/milestone_resize.mp3',
  milestoneCreate:       '/sounds/dependency/milestone_create.mp3',
  milestoneDelete:       '/sounds/dependency/milestone_delete.mp3',
  milestoneRename:       '/sounds/dependency/milestone_rename.mp3',

  // Connection interactions
  connectionCreate:      '/sounds/dependency/connection_create.mp3',
  connectionDelete:      '/sounds/dependency/connection_delete.mp3',
  connectionSelect:      '/sounds/dependency/connection_select.mp3',

  // Drag interactions
  teamDragStart:         '/sounds/dependency/team_drag_start.mp3',
  teamDragDrop:          '/sounds/dependency/team_drag_drop.mp3',
  taskDragStart:         '/sounds/dependency/task_drag_start.mp3',
  taskDragDrop:          '/sounds/dependency/task_drag_drop.mp3',

  // Warnings / blocked actions
  warning:               '/sounds/dependency/warning.mp3',
  blocked:               '/sounds/dependency/blocked.mp3',
  moveBlocked:           '/sounds/dependency/move_blocked.mp3',

  // View mode changes
  modeSwitch:            '/sounds/dependency/mode_switch.mp3',

  // UI feedback
  click:                 '/sounds/dependency/click.mp3',
  toggleCollapse:        '/sounds/dependency/toggle_collapse.mp3',
  toggleVisibility:      '/sounds/dependency/toggle_visibility.mp3',

  // Multi-select / marquee
  marqueeStart:          '/sounds/dependency/marquee_start.mp3',
  marqueeEnd:            '/sounds/dependency/marquee_end.mp3',
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
    console.warn(`[sounds] Unknown sound key: "${key}"`);
    return;
  }

  try {
    // Reuse or create Audio element
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