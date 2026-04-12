import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { uploadDocuments } from "../api/client";

const ACCEPTED = ".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.json,.csv";
const MAX_SIZE_MB = 10;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Upload() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid: File[] = [];
    const errs: string[] = [];

    Array.from(incoming).forEach((f) => {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        errs.push(`${f.name} is too large (max ${MAX_SIZE_MB} MB)`);
      } else {
        valid.push(f);
      }
    });

    if (errs.length) setError(errs.join(", "));
    setFiles((prev) => {
      const names = new Set(prev.map((x) => x.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    setError("");
    addFiles(e.dataTransfer.files);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError("");
    addFiles(e.target.files);
    e.target.value = "";
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      await uploadDocuments(files);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto glass-card p-8 sm:p-10">
      <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-indigo-800 mb-2">Upload Documents</h1>
      <p className="text-slate-500 text-sm mb-8">
        Upload one or more files. Each file will be queued for async background processing.
      </p>

      {/* drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
          dragging
            ? "border-blue-500 bg-blue-50/50 scale-[1.02]"
            : "border-slate-300 bg-white/50 hover:border-blue-400 hover:bg-slate-50/50 hover:shadow-md"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={onFileChange}
        />
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-100 to-indigo-50 rounded-full flex items-center justify-center shadow-sm">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-slate-700 font-semibold text-lg">
              {dragging ? "Drop files here..." : "Click to browse or drag & drop"}
            </p>
            <p className="text-slate-400 text-sm mt-1">PDF, TXT, DOC, DOCX, PNG, JPG, JSON, CSV — max {MAX_SIZE_MB} MB each</p>
          </div>
        </div>
      </div>

      {/* error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl text-sm justify-center items-center flex text-red-600 font-medium animate-pulse">
          {error}
        </div>
      )}

      {/* file list */}
      {files.length > 0 && (
        <div className="mt-8 bg-white/60 rounded-2xl border border-slate-200/60 divide-y divide-slate-100/50 overflow-hidden shadow-sm">
          {files.map((f) => (
            <div key={f.name} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white transition-colors group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{f.name}</p>
                <p className="text-xs text-slate-400 font-medium">{formatSize(f.size)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                className="text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors p-2 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* actions */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={handleUpload}
          disabled={!files.length || uploading}
          className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:shadow-lg disabled:shadow-none"
        >
          {uploading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Uploading...
            </>
          ) : (
            `Upload ${files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : ""}`
          )}
        </button>
        {files.length > 0 && (
          <button
            onClick={() => setFiles([])}
            className="px-6 py-3 border border-slate-300 text-slate-600 hover:bg-white hover:text-slate-800 rounded-xl text-sm font-medium transition-colors shadow-sm focus:outline-none"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
