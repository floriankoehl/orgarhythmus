/**
 * Lightweight confirmation modal — mirrors IdeaBinConfirmModal.
 */
export default function TaskConfirmModal({ modal }) {
  if (!modal) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 rounded-lg">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-[260px] mx-4">
        <div className="mb-3">{modal.message}</div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={modal.onCancel}
            className="px-3 py-1 text-[11px] text-gray-600 hover:text-gray-800 rounded border border-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={modal.onConfirm}
            className={`px-3 py-1 text-[11px] text-white rounded font-medium ${modal.confirmColor || "bg-red-500 hover:bg-red-600"}`}
          >
            {modal.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
