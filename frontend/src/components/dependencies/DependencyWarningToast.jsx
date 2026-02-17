import { useState, useEffect, useRef } from 'react';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const TOAST_DURATION = 7000; // 7 seconds visible
const FADE_DURATION = 400;   // fade-out animation

/**
 * Warning toast that shows messages for 7 seconds then fades out.
 * Only shows recent messages, auto-cleans old ones.
 */
export default function DependencyWarningToast({ warningMessages }) {
  const [toasts, setToasts] = useState([]);
  const lastSeenId = useRef(0);

  useEffect(() => {
    // Find only new messages we haven't processed yet
    const newMessages = warningMessages.filter(m => m.id > lastSeenId.current);
    if (newMessages.length === 0) return;

    // Update the last seen id
    lastSeenId.current = Math.max(...newMessages.map(m => m.id));

    // Add new toasts
    const now = Date.now();
    const newToasts = newMessages.map(m => ({
      ...m,
      addedAt: now,
      fading: false,
    }));

    setToasts(prev => [...prev, ...newToasts]);

    // Schedule fade-out for each new toast
    for (const toast of newToasts) {
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === toast.id ? { ...t, fading: true } : t));
      }, TOAST_DURATION);

      // Remove from DOM after fade completes
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, TOAST_DURATION + FADE_DURATION);
    }
  }, [warningMessages]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((msg) => (
        <div
          key={msg.id}
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg shadow-lg border pointer-events-auto bg-amber-50 border-amber-200 text-amber-900"
          style={{
            opacity: msg.fading ? 0 : 1,
            transition: `opacity ${FADE_DURATION}ms ease-out`,
          }}
        >
          <WarningAmberIcon style={{ fontSize: 16, marginTop: 2 }} className="text-amber-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight">{msg.message}</p>
            {msg.details && (
              <p className="text-[10px] text-amber-700 mt-0.5 leading-snug">{msg.details}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
