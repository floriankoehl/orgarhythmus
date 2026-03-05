/**
 * Cross-window data synchronisation — manual-refresh model.
 *
 * emitDataEvent('tasks')      — mark data as stale (visual indicator only)
 * triggerManualRefresh()       — user-initiated: fires all registered refresh callbacks
 * useManualRefresh(callback)   — register a callback for manual refresh
 * useStaleData()               — returns `true` when unseen changes exist
 */
import { useEffect, useRef, useState } from 'react';

/* ── Stale flag bookkeeping ── */
let _stale = false;
const _staleListeners = new Set();
function _notify() { _staleListeners.forEach(fn => fn(_stale)); }

/** Mark data as stale (called after mutations). */
export function emitDataEvent(_type) {
  if (!_stale) { _stale = true; _notify(); }
}

/** User-initiated: refresh all windows and clear the stale flag. */
export function triggerManualRefresh() {
  _stale = false;
  _notify();
  window.dispatchEvent(new CustomEvent('data-manual-refresh'));
}

/** Hook — returns `true` when data has changed since last manual refresh. */
export function useStaleData() {
  const [stale, setStale] = useState(_stale);
  useEffect(() => {
    _staleListeners.add(setStale);
    setStale(_stale);          // sync on mount
    return () => _staleListeners.delete(setStale);
  }, []);
  return stale;
}

/** Hook — call `callback` when the user triggers a manual refresh. */
export function useManualRefresh(callback) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  useEffect(() => {
    const handler = () => cbRef.current();
    window.addEventListener('data-manual-refresh', handler);
    return () => window.removeEventListener('data-manual-refresh', handler);
  }, []);
}
