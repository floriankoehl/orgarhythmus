/**
 * Shared z-index manager for floating windows (IdeaBin, TaskStructure, etc.).
 *
 * Each window calls `getNextZIndex()` on mousedown/focus to bring itself to front.
 * The base value is high enough to sit above normal page content.
 */

let counter = 9980;

export function getNextZIndex() {
  counter += 1;
  return counter;
}

export function getCurrentZIndex() {
  return counter;
}
