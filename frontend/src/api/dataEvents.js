/**
 * Cross-window data synchronisation — dual mode (auto / manual).
 *
 * Auto mode  : emitDataEvent → debounced 300ms → all listeners fire automatically.
 * Manual mode: emitDataEvent → stale indicator shown → user clicks Refresh button.
 *
 * The mode is persisted in localStorage and togglable at runtime.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/* ── Setting: auto-refresh toggle (persisted in localStorage) ── */
const SETTING_KEY = 'data-sync-auto-refresh';
let _autoRefresh = localStorage.getItem(SETTING_KEY) !== 'false'; // default ON

const _settingListeners = new Set();
function _notifySetting() { _settingListeners.forEach(fn => fn(_autoRefresh)); }

export function setAutoRefresh(enabled) {
  _autoRefresh = enabled;
  localStorage.setItem(SETTING_KEY, enabled ? 'true' : 'false');
  _notifySetting();
  if (!enabled && _autoTimer) { clearTimeout(_autoTimer); _autoTimer = null; }
}

/** Hook — returns current auto-refresh setting (reactive). */
export function useAutoRefreshSetting() {
  const [auto, setAuto] = useState(_autoRefresh);
  useEffect(() => {
    _settingListeners.add(setAuto);
    setAuto(_autoRefresh);
    return () => _settingListeners.delete(setAuto);
  }, []);
  return auto;
}

/* ── Stale flag bookkeeping (manual mode indicator) ── */
let _stale = false;
const _staleListeners = new Set();
function _notifyStale() { _staleListeners.forEach(fn => fn(_stale)); }

/** Hook — returns `true` when unseen changes exist (manual mode). */
export function useStaleData() {
  const [stale, setStale] = useState(_stale);
  useEffect(() => {
    _staleListeners.add(setStale);
    setStale(_stale);
    return () => _staleListeners.delete(setStale);
  }, []);
  return stale;
}

/* ── Auto-refresh debounce timer ── */
let _autoTimer = null;

/** Mark data as changed. Auto mode: debounced refresh. Manual mode: stale flag. */
export function emitDataEvent(_type) {
  if (_autoRefresh) {
    if (_autoTimer) clearTimeout(_autoTimer);
    _autoTimer = setTimeout(() => {
      _autoTimer = null;
      window.dispatchEvent(new CustomEvent('data-manual-refresh'));
    }, 300);
  } else {
    if (!_stale) { _stale = true; _notifyStale(); }
  }
}

/** User-initiated: refresh all windows and clear the stale flag. */
export function triggerManualRefresh() {
  _stale = false;
  _notifyStale();
  if (_autoTimer) { clearTimeout(_autoTimer); _autoTimer = null; }
  window.dispatchEvent(new CustomEvent('data-manual-refresh'));
}

/** Hook — call `callback` when a refresh fires (auto or manual). */
export function useManualRefresh(callback) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  useEffect(() => {
    const handler = () => cbRef.current();
    window.addEventListener('data-manual-refresh', handler);
    return () => window.removeEventListener('data-manual-refresh', handler);
  }, []);
}
