// Phase CRUD and drag/resize application service.
// Generic version — API calls extracted into callbacks.

import { useRef, useCallback } from 'react';
import { playSound, startLoopSound, stopLoopSound } from '../assets/sound_registry';

/**
 * Manages phase create/update/delete operations and drag/resize interactions.
 *
 * Persist callbacks (adapter-supplied):
 * @param {Function} params.persistPhaseCreate - async (phaseData) => created
 * @param {Function} params.persistPhaseUpdate - async (phaseId, phaseData) => updated
 * @param {Function} params.persistPhaseDelete - async (phaseId) => void
 */
export function usePhaseManagement({
  phases,
  setPhases,
  COLUMNWIDTH,
  // Persist callbacks
  persistPhaseCreate,
  persistPhaseUpdate,
  persistPhaseDelete,
}) {
  const phasesRef = useRef(phases);
  phasesRef.current = phases;

  // ── Overlap detection ──

  const wouldPhaseOverlap = useCallback((phaseId, startIdx, dur, laneId) => {
    for (const p of phasesRef.current) {
      if (p.id === phaseId) continue;
      const sameScope =
        (laneId == null && p.lane == null) ||
        (laneId != null && p.lane != null && String(p.lane) === String(laneId));
      if (!sameScope) continue;
      if (startIdx < p.start_index + p.duration && startIdx + dur > p.start_index) {
        return true;
      }
    }
    return false;
  }, []);

  // ── CRUD ──

  const handleCreatePhase = useCallback(async (phaseData) => {
    try {
      const created = persistPhaseCreate ? await persistPhaseCreate(phaseData) : phaseData;
      setPhases(prev => [...prev, created]);
      playSound('phaseCreate');
      return created;
    } catch (err) {
      console.error('Failed to create phase:', err);
      alert('Failed to create phase: ' + (err.message || err));
    }
  }, [persistPhaseCreate, setPhases]);

  const handleUpdatePhase = useCallback(async (phaseId, phaseData) => {
    try {
      const updated = persistPhaseUpdate ? await persistPhaseUpdate(phaseId, phaseData) : phaseData;
      setPhases(prev => prev.map(p => (p.id === phaseId ? { ...p, ...updated } : p)));
      playSound('phaseUpdate');
      return updated;
    } catch (err) {
      console.error('Failed to update phase:', err);
      alert('Failed to update phase: ' + (err.message || err));
    }
  }, [persistPhaseUpdate, setPhases]);

  const handleDeletePhase = useCallback(async (phaseId) => {
    try {
      if (persistPhaseDelete) await persistPhaseDelete(phaseId);
      setPhases(prev => prev.filter(p => p.id !== phaseId));
      playSound('phaseDelete');
    } catch (err) {
      console.error('Failed to delete phase:', err);
    }
  }, [persistPhaseDelete, setPhases]);

  // ── Edge resize ──

  const handlePhaseEdgeResize = useCallback((e, phaseId, edge) => {
    e.stopPropagation();
    e.preventDefault();

    const phase = phasesRef.current.find(p => p.id === phaseId);
    if (!phase) return;

    const startX = e.clientX;
    const initialStartIndex = phase.start_index;
    const initialDuration = phase.duration || 1;
    const laneId = phase.lane;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const indexDelta = Math.round(deltaX / COLUMNWIDTH);

      setPhases(prev =>
        prev.map(p => {
          if (p.id !== phaseId) return p;
          let newStart = p.start_index;
          let newDur = p.duration;
          if (edge === 'right') {
            newDur = Math.max(1, initialDuration + indexDelta);
            newStart = initialStartIndex;
          } else if (edge === 'left') {
            newStart = Math.max(0, initialStartIndex + indexDelta);
            const durationChange = initialStartIndex - newStart;
            newDur = Math.max(1, initialDuration + durationChange);
          }
          if (wouldPhaseOverlap(phaseId, newStart, newDur, laneId)) return p;
          return { ...p, start_index: newStart, duration: newDur };
        })
      );
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      stopLoopSound('dragLoop');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      playSound('phaseUpdate');
      setPhases(prev => {
        const current = prev.find(p => p.id === phaseId);
        if (current && persistPhaseUpdate) {
          persistPhaseUpdate(phaseId, {
            start_index: current.start_index,
            duration: current.duration,
          }).catch(err => console.error('Failed to persist phase resize:', err));
        }
        return prev;
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
  }, [COLUMNWIDTH, setPhases, wouldPhaseOverlap, persistPhaseUpdate]);

  // ── Body drag (move) ──

  const handlePhaseDrag = useCallback((e, phaseId) => {
    e.stopPropagation();
    e.preventDefault();

    const phase = phasesRef.current.find(p => p.id === phaseId);
    if (!phase) return;

    const startX = e.clientX;
    const initialStartIndex = phase.start_index;
    const duration = phase.duration || 1;
    const laneId = phase.lane;
    let moved = false;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const indexDelta = Math.round(deltaX / COLUMNWIDTH);
      if (indexDelta === 0 && !moved) return;
      moved = true;

      setPhases(prev =>
        prev.map(p => {
          if (p.id !== phaseId) return p;
          const newStartIndex = Math.max(0, initialStartIndex + indexDelta);
          if (wouldPhaseOverlap(phaseId, newStartIndex, duration, laneId)) return p;
          return { ...p, start_index: newStartIndex };
        })
      );
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      stopLoopSound('dragLoop');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (!moved) return;

      playSound('phaseUpdate');
      setPhases(prev => {
        const current = prev.find(p => p.id === phaseId);
        if (current && persistPhaseUpdate) {
          persistPhaseUpdate(phaseId, { start_index: current.start_index }).catch(err => {
            console.error('Failed to persist phase move:', err);
            alert('Failed to move phase: ' + (err?.message || 'Unknown error'));
          });
        }
        return prev;
      });
    };

    document.body.style.cursor = 'grab';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
  }, [COLUMNWIDTH, setPhases, wouldPhaseOverlap, persistPhaseUpdate]);

  return {
    phasesRef,
    handleCreatePhase,
    handleUpdatePhase,
    handleDeletePhase,
    handlePhaseEdgeResize,
    handlePhaseDrag,
    wouldPhaseOverlap,
  };
}
