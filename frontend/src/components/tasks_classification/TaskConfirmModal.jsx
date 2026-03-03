import { useEffect, useRef } from "react";

/**
 * Lightweight confirmation modal — mirrors IdeaBinConfirmModal.
 * Supports Enter to confirm, Escape to cancel.
 */
export default function TaskConfirmModal({ modal }) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (!modal) return;
    // Focus confirm button so Enter works immediately
    confirmBtnRef.current?.focus();

    const handler = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        modal.onConfirm?.();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        modal.onCancel?.();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [modal]);

  if (!modal) return null;

  return (
    <div className="absolute inset-0 z-[9000] flex items-center justify-center bg-black/20 rounded-lg">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-[320px] mx-4">
        <div className="mb-3">{modal.message}</div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] text-gray-400 italic">Enter to confirm</span>
          <div className="flex items-center gap-2">
            <button
              onClick={modal.onCancel}
              className="px-3 py-1 text-[11px] text-gray-600 hover:text-gray-800 rounded border border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              ref={confirmBtnRef}
              onClick={modal.onConfirm}
              className={`px-3 py-1 text-[11px] text-white rounded font-medium ${modal.confirmColor || "bg-red-500 hover:bg-red-600"}`}
            >
              {modal.confirmLabel || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
