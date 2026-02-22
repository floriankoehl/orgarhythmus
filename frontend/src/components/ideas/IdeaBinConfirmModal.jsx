// ───────────────────── Confirm Modal ─────────────────────
import { useEffect, useRef } from "react";

export default function IdeaBinConfirmModal({ message, onConfirm, onCancel, confirmLabel = "Delete", confirmColor = "bg-red-500 hover:bg-red-600" }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <>
      <div className="absolute inset-0 bg-black/30 z-[9998] rounded-b-lg" onClick={onCancel} />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl p-5 z-[9999] min-w-[240px] max-w-[90%]"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onConfirm(); } }}
      >
        <div className="text-sm mb-4">{message}</div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100 text-xs">
            Cancel
          </button>
          <button ref={confirmRef} onClick={onConfirm} className={`px-3 py-1.5 rounded text-white text-xs ${confirmColor}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
