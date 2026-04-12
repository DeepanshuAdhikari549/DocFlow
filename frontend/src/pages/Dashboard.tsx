import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDocuments, retryDocument, deleteDocument } from "../api/client";
import type { Document, Status } from "../types";
import StatusBadge from "../components/StatusBadge";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "queued",     label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "completed",  label: "Completed" },
  { value: "failed",     label: "Failed" },
  { value: "finalized",  label: "Finalized" },
];

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string) {
  // Ensure the date string is treated as UTC (FastAPI/SQLite default)
  const date = new Date(dateStr);
  const utcDate = dateStr.endsWith("Z") || dateStr.includes("+") ? date : new Date(dateStr + "Z");
  
  const diff = Date.now() - utcDate.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Dashboard() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchDocs = useCallback(async () => {
    try {
      const res = await getDocuments({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        limit: 50,
      });
      setDocs(res.documents);
      setTotal(res.total);
    } catch {
      // silently retry
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchDocs();
    // auto-refresh every 3s if any job is active
    const timer = setInterval(() => {
      fetchDocs();
    }, 3000);
    return () => clearInterval(timer);
  }, [fetchDocs]);

  const handleRetry = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRetryingId(id);
    try {
      await retryDocument(id);
      fetchDocs();
    } catch {
      alert("Failed to retry job.");
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    setDeletingId(id);
    try {
      await deleteDocument(id);
      fetchDocs();
    } catch {
      alert("Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = docs.filter((d) => d.status === "processing" || d.status === "queued").length;

  return (
    <div>
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} total
            {activeCount > 0 && (
              <span className="ml-2 text-blue-600 font-medium">• {activeCount} processing</span>
            )}
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload
        </Link>
      </div>

      {/* filters row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none"
            viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by filename or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* sort */}
        <select
          value={`${sortBy}:${sortOrder}`}
          onChange={(e) => {
            const [by, ord] = e.target.value.split(":");
            setSortBy(by);
            setSortOrder(ord);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="created_at:desc">Newest first</option>
          <option value="created_at:asc">Oldest first</option>
          <option value="original_filename:asc">Name A→Z</option>
          <option value="original_filename:desc">Name Z→A</option>
          <option value="file_size:desc">Largest first</option>
        </select>
      </div>

      {/* status filter tabs */}
      <div className="flex gap-1 mb-5 overflow-x-auto scrollbar-hide">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === f.value
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-blue-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* table / list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-24 glass-card border-dashed">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-100 to-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-white">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600 text-lg font-medium">No documents found</p>
          <p className="text-gray-400 text-sm mt-1 mb-5">
            {search || statusFilter !== "all" ? "Try adjusting your filters to find what you're looking for." : "Upload your first file to get started."}
          </p>
          {!search && statusFilter === "all" && (
            <Link to="/upload"
              className="inline-block px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5">
              Upload Document
            </Link>
          )}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* desktop header */}
          <div className="hidden sm:grid grid-cols-12 px-4 py-3 bg-white/40 border-b border-gray-200/60 text-xs font-semibold text-slate-500 uppercase tracking-wider backdrop-blur-md">
            <div className="col-span-5">File Node</div>
            <div className="col-span-2">Task Status</div>
            <div className="col-span-2">Filesize</div>
            <div className="col-span-2">Timestamp</div>
            <div className="col-span-1" />
          </div>

          <div className="divide-y divide-gray-100/50">
            {docs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => navigate(`/documents/${doc.id}`)}
                className="grid grid-cols-12 items-center px-4 py-4 hover:bg-white/60 cursor-pointer transition-colors group"
              >
                {/* filename */}
                <div className="col-span-10 sm:col-span-5 flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{doc.original_filename}</p>
                    <p className="text-xs text-slate-400 sm:hidden mt-0.5">
                      {formatSize(doc.file_size)} &bull; {timeAgo(doc.created_at)}
                    </p>
                  </div>
                </div>

                {/* status */}
                <div className="hidden sm:flex col-span-2 items-center">
                  <StatusBadge status={doc.status as Status} size="sm" />
                </div>

                {/* size */}
                <div className="hidden sm:block col-span-2 text-sm font-medium text-slate-500">
                  {formatSize(doc.file_size)}
                </div>

                {/* time */}
                <div className="hidden sm:block col-span-2 text-sm text-slate-400">
                  {timeAgo(doc.created_at)}
                </div>

                {/* actions */}
                <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1">
                  {/* mobile status badge */}
                  <span className="sm:hidden">
                    <StatusBadge status={doc.status as Status} size="sm" />
                  </span>

                  {doc.status === "failed" && (
                    <button
                      onClick={(e) => handleRetry(e, doc.id)}
                      disabled={retryingId === doc.id || deletingId === doc.id}
                      title="Retry"
                      className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50 hover:shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                  
                  <button
                    onClick={(e) => handleDelete(e, doc.id)}
                    disabled={deletingId === doc.id}
                    title="Delete"
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 hover:shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
