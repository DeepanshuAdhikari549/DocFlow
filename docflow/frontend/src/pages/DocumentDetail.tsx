import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDocument, updateReview, finalizeDocument, exportDocument, retryDocument } from "../api/client";
import type { Document, ExtractedData, Status } from "../types";
import StatusBadge from "../components/StatusBadge";
import ProgressTracker from "../components/ProgressTracker";

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<ExtractedData | null>(null);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDoc = async () => {
    if (!id) return;
    try {
      const d = await getDocument(id);
      setDoc(d);
      return d;
    } catch {
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoc();
  }, [id]);

  // real-time progress tracking with SSE
  useEffect(() => {
    if (!doc) return;
    const active = doc.status === "queued" || doc.status === "processing";
    let eventSource: EventSource | null = null;

    if (active) {
      eventSource = new EventSource(`/api/documents/${doc.id}/progress/stream`);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          setDoc((prev) => {
            if (!prev) return prev;
            
            // if we completed or failed, we probably want to fetch the entire document 
            // from the backend to get the extracted data
            if (data.event === "job_completed" || data.event === "job_failed") {
              fetchDoc();
            }

            return {
              ...prev,
              progress: data.progress,
              current_stage: data.stage,
              status: (data.event === "job_completed") ? "completed" : (data.event === "job_failed" ? "failed" : prev.status),
              error_message: data.message && data.event === "job_failed" ? data.message : prev.error_message
            };
          });
          
          if (data.event === "job_completed" || data.event === "job_failed") {
            eventSource?.close();
          }
        } catch (e) {
          console.error("Failed to parse SSE data", e);
        }
      };

      eventSource.onerror = () => {
        // Fallback or reconnect logic
        eventSource?.close();
      };
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [doc?.id, doc?.status]); // specifically avoid putting doc inside deps to prevent re-subscribing 

  const displayData = doc?.reviewed_data || doc?.extracted_data;

  const startEdit = () => {
    if (!displayData) return;
    setEditData(JSON.parse(JSON.stringify(displayData)));
    setEditMode(true);
    setSaveMsg("");
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditData(null);
    setSaveMsg("");
  };

  const saveEdit = async () => {
    if (!id || !editData) return;
    setSaving(true);
    try {
      const updated = await updateReview(id, editData);
      setDoc(updated);
      setEditMode(false);
      setSaveMsg("Changes saved!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch {
      setSaveMsg("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!id) return;
    if (!window.confirm("Finalize this document? This locks the reviewed output.")) return;
    setFinalizing(true);
    try {
      const updated = await finalizeDocument(id);
      setDoc(updated);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Finalize failed.");
    } finally {
      setFinalizing(false);
    }
  };

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      await retryDocument(id);
      await fetchDoc();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Retry failed.");
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* back */}
      <button onClick={() => navigate("/dashboard")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {/* title row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{doc.original_filename}</h1>
            <StatusBadge status={doc.status as Status} />
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {doc.file_type || "unknown type"} · {formatSize(doc.file_size)}
            {doc.retry_count > 0 && <span className="ml-2 text-orange-500">retried {doc.retry_count}×</span>}
          </p>
        </div>

        {/* action buttons */}
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {doc.status === "failed" && (
            <button onClick={handleRetry} disabled={retrying}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {retrying ? "Retrying..." : "Retry"}
            </button>
          )}
          {doc.status === "completed" && !editMode && (
            <>
              <button onClick={startEdit}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors">
                Edit Result
              </button>
              <button onClick={handleFinalize} disabled={finalizing}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {finalizing ? "Finalizing..." : "Finalize"}
              </button>
            </>
          )}
          {doc.is_finalized && (
            <div className="flex gap-2">
              <button onClick={() => exportDocument(doc.id, "json")}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                JSON
              </button>
              <button onClick={() => exportDocument(doc.id, "csv")}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* left: progress */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Processing Pipeline</h2>
            <ProgressTracker
              currentStage={doc.current_stage}
              progress={doc.progress}
              status={doc.status}
            />
            {doc.error_message && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                <p className="font-medium mb-0.5">Error</p>
                {doc.error_message}
              </div>
            )}
          </div>
        </div>

        {/* right: extracted data */}
        <div className="md:col-span-2">
          {(doc.status === "queued" || doc.status === "processing") && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center justify-center min-h-48">
              <svg className="w-8 h-8 animate-spin text-blue-400 mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-gray-500 text-sm">Processing document...</p>
              <p className="text-gray-400 text-xs mt-1">This page refreshes automatically</p>
            </div>
          )}

          {doc.status === "failed" && !doc.extracted_data && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center justify-center min-h-48">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium text-sm">Processing failed</p>
              <p className="text-gray-400 text-xs mt-1">Click "Retry" to try again</p>
            </div>
          )}

          {displayData && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">
                  {doc.reviewed_data ? "Reviewed Output" : "Extracted Output"}
                  {doc.is_finalized && (
                    <span className="ml-2 text-xs text-purple-600 font-normal">· Finalized</span>
                  )}
                </h2>
                {saveMsg && (
                  <span className={`text-xs font-medium ${saveMsg.includes("Failed") ? "text-red-500" : "text-green-600"}`}>
                    {saveMsg}
                  </span>
                )}
              </div>

              {editMode && editData ? (
                /* ── edit form ── */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                    <input type="text" value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                    <input type="text" value={editData.category}
                      onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Summary</label>
                    <textarea rows={4} value={editData.summary}
                      onChange={(e) => setEditData({ ...editData, summary: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Keywords (comma separated)
                    </label>
                    <input type="text"
                      value={editData.extracted_keywords.join(", ")}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          extracted_keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={saveEdit} disabled={saving}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button onClick={cancelEdit}
                      className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── read view ── */
                <div className="space-y-4">
                  <InfoRow label="Title" value={displayData.title} />
                  <InfoRow label="Category" value={displayData.category} />
                  <InfoRow label="Language" value={displayData.language} />
                  <InfoRow label="Word Count" value={displayData.word_count?.toString()} />
                  <InfoRow label="Page Count" value={displayData.page_count?.toString()} />
                  <InfoRow label="Confidence" value={`${Math.round((displayData.confidence_score || 0) * 100)}%`} />

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Summary</p>
                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">
                      {displayData.summary}
                    </p>
                  </div>

                  {displayData.extracted_keywords?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {displayData.extracted_keywords.map((kw) => (
                          <span key={kw}
                            className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {displayData.file_metadata && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">File Metadata</p>
                      <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <MetaItem k="Type" v={displayData.file_metadata.file_type || "—"} />
                        <MetaItem k="Size" v={`${displayData.file_metadata.file_size_kb} KB`} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-4">
      <p className="text-xs font-medium text-gray-500 w-24 flex-shrink-0 pt-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value || "—"}</p>
    </div>
  );
}

function MetaItem({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{k}</p>
      <p className="text-xs font-medium text-gray-700">{v}</p>
    </div>
  );
}
