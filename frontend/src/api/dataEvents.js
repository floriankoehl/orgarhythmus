/**
 * Cross-window data synchronisation via CustomEvent.
 *
 * Event types: 'tasks', 'teams', 'milestones'
 *
 * Usage:
 *   emitDataEvent('tasks')                        — broadcast that task data changed
 *   useDataRefresh(['tasks','teams'], cb, muteRef) — react to changes from *other* windows
 */
import { useEffect, useRef } from 'react';

const EVENT_NAME = 'data-sync';

/** Dispatch a data-sync event.  Listeners fire synchronously. */
export function emitDataEvent(type) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { type } }));
}

/**
 * React hook — listen for data-sync events of the given types and invoke `callback`.
 *
 * @param {string[]}  types       e.g. ['tasks', 'teams']
 * @param {() => void} callback   called when a matching event arrives
 * @param {React.MutableRefObject<boolean>} [mutingRef]
 *   Optional — when `mutingRef.current` is `true` the callback is skipped and the
 *   ref is reset.  Set it to `true` right before calling `emitDataEvent` so the
 *   emitting component doesn't trigger its own listener.
 */
export function useDataRefresh(types, callback, mutingRef) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  // Stable key so the effect only re-subscribes when the set of types changes.
  const typesKey = types.join(',');

  useEffect(() => {
    const typeSet = new Set(typesKey.split(','));

    const handler = (e) => {
      if (!typeSet.has(e.detail?.type)) return;
      if (mutingRef?.current) {
        mutingRef.current = false;
        return;
      }
      cbRef.current();
    };

    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [typesKey, mutingRef]);
}
