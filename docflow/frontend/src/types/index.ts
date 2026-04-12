export type Status = "queued" | "processing" | "completed" | "failed" | "finalized";

export interface ExtractedData {
  title: string;
  category: string;
  summary: string;
  extracted_keywords: string[];
  file_metadata: {
    filename: string;
    file_type: string;
    file_size_bytes: number;
    file_size_kb: number;
  };
  word_count: number;
  page_count: number;
  language: string;
  confidence_score: number;
  extracted_at: string;
}

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_type: string | null;
  file_size: number | null;
  status: Status;
  progress: number;
  current_stage: string;
  extracted_data: ExtractedData | null;
  reviewed_data: ExtractedData | null;
  is_finalized: boolean;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export interface ProgressEvent {
  document_id: string;
  event: string;
  progress: number;
  stage: string;
  message: string;
  timestamp: string;
}
