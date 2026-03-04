// SafetyCheckPanel — Displays results of a scheduling safety check.
// Generic version — uses node/edge/row terminology.
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const SEVERITY_STYLES = {
  error: {
    headerBg: 'bg-red-50',
    headerText: 'text-red-700',
    headerBorder: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    issueHover: 'hover:bg-red-50',
    dot: 'bg-red-500',
  },
  warning: {
    headerBg: 'bg-amber-50',
    headerText: 'text-amber-700',
    headerBorder: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    issueHover: 'hover:bg-amber-50',
    dot: 'bg-amber-500',
  },
  info: {
    headerBg: 'bg-slate-50',
    headerText: 'text-slate-500',
    headerBorder: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-500',
    issueHover: 'hover:bg-slate-50',
    dot: 'bg-slate-400',
  },
};

export default function SafetyCheckPanel({
  results,
  isRunning,
  onClose,
  onLocateIssue,
}) {
  if (!results && !isRunning) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate"
      onClick={onClose}
    >
      <div
        className="rounded-2xl border border-slate-200 bg-white shadow-2xl w-full max-w-2xl mx-4 modal-animate-in flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-slate-800">Safety Check</span>
            {isRunning && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Running…
              </span>
            )}
            {results && !isRunning && results.totalIssues === 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-xs font-medium">
                <CheckCircleOutlineIcon style={{ fontSize: 14 }} />
                All clear
              </span>
            )}
            {results && !isRunning && results.totalIssues > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium">
                <ErrorOutlineIcon style={{ fontSize: 14 }} />
                {results.totalIssues} issue{results.totalIssues !== 1 ? 's' : ''} found
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <CloseIcon style={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isRunning && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin mb-3" />
              <p className="text-sm">Fetching fresh data and validating…</p>
            </div>
          )}

          {results && results.error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              Safety check failed: {results.error}
            </div>
          )}

          {results && !results.error && results.totalIssues === 0 && !isRunning && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CheckCircleOutlineIcon style={{ fontSize: 48 }} className="text-green-400 mb-3" />
              <p className="text-base font-medium text-green-600">No scheduling issues found</p>
              <p className="text-xs text-slate-400 mt-1">All edges, deadlines, and grid boundaries are respected.</p>
            </div>
          )}

          {results && !results.error && results.totalIssues > 0 && !isRunning && (
            <>
              {results.categories
                .filter(cat => cat.issues.length > 0)
                .map(cat => {
                  const style = SEVERITY_STYLES[cat.severity] || SEVERITY_STYLES.info;
                  return (
                    <div key={cat.key} className="rounded-lg border border-slate-200 overflow-hidden">
                      <div className={`flex items-center justify-between px-4 py-2.5 ${style.headerBg} ${style.headerBorder} border-b`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{cat.icon}</span>
                          <span className={`text-sm font-semibold ${style.headerText}`}>{cat.label}</span>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
                          {cat.issues.length}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {cat.issues.map((issue, idx) => (
                          <button
                            key={idx}
                            onClick={() => onLocateIssue(issue)}
                            className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition ${style.issueHover} cursor-pointer group`}
                          >
                            <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-700 leading-relaxed">{issue.message}</p>
                              {issue.sourceRow && issue.targetRow && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {issue.sourceRow.name} → {issue.targetRow.name}
                                  {issue.edge?.weight && (
                                    <span className="ml-1 text-slate-300">({issue.edge.weight})</span>
                                  )}
                                </p>
                              )}
                              {issue.row && !issue.targetRow && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  Row: {issue.row.name}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-300 group-hover:text-blue-500 transition flex-shrink-0 mt-0.5">
                              Locate →
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] text-slate-400">
            Data fetched fresh from database.
            Click any issue to locate it on the grid.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
