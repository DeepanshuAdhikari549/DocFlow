interface Stage {
  key: string;
  label: string;
  percent: number;
}

const STAGES: Stage[] = [
  { key: "job_queued",                   label: "Queued",              percent: 0   },
  { key: "job_started",                  label: "Started",             percent: 5   },
  { key: "document_parsing_started",     label: "Parsing",             percent: 20  },
  { key: "document_parsing_completed",   label: "Parsed",              percent: 45  },
  { key: "field_extraction_started",     label: "Extracting Fields",   percent: 60  },
  { key: "field_extraction_completed",   label: "Fields Extracted",    percent: 85  },
  { key: "job_completed",                label: "Completed",           percent: 100 },
];

interface Props {
  currentStage: string;
  progress: number;
  status: string;
}

export default function ProgressTracker({ currentStage, progress, status }: Props) {
  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);
  const activePct = status === "failed" ? progress : progress;

  return (
    <div className="w-full">
      {/* progress bar */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">Progress</span>
        <span className="text-sm font-semibold text-gray-700">{activePct}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${
            status === "failed"
              ? "bg-red-500"
              : status === "finalized"
              ? "bg-purple-500"
              : "bg-blue-500"
          }`}
          style={{ width: `${activePct}%` }}
        />
      </div>

      {/* stages */}
      <div className="space-y-2">
        {STAGES.map((stage, idx) => {
          const done = currentIdx > idx || status === "completed" || status === "finalized";
          const active = currentIdx === idx && status === "processing";
          const failed = status === "failed" && currentIdx === idx;

          return (
            <div key={stage.key} className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border-2 transition-all ${
                  failed
                    ? "bg-red-100 border-red-400 text-red-600"
                    : done
                    ? "bg-green-500 border-green-500 text-white"
                    : active
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {done ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : failed ? (
                  "✕"
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`text-sm ${
                  failed
                    ? "text-red-600 font-medium"
                    : done
                    ? "text-gray-700 font-medium"
                    : active
                    ? "text-blue-600 font-medium"
                    : "text-gray-400"
                }`}
              >
                {stage.label}
                {active && (
                  <span className="ml-1.5 inline-block">
                    <span className="inline-flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
