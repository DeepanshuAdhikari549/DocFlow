import type { Status } from "../types";

const config: Record<Status, { label: string; className: string; dot: string }> = {
  queued:     { label: "Queued",     className: "bg-gray-100 text-gray-600",   dot: "bg-gray-400" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-700",   dot: "bg-blue-500 animate-pulse" },
  completed:  { label: "Completed",  className: "bg-green-100 text-green-700", dot: "bg-green-500" },
  failed:     { label: "Failed",     className: "bg-red-100 text-red-700",     dot: "bg-red-500" },
  finalized:  { label: "Finalized",  className: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
};

interface Props {
  status: Status;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: Props) {
  const c = config[status] || config.queued;
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${padding} ${c.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
