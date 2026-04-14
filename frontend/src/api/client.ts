import axios from "axios";
import type { Document, DocumentListResponse, ExtractedData } from "../types";

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || "") + "/api",
  timeout: 30000,
});

export const uploadDocuments = async (files: File[]): Promise<Document[]> => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await api.post<Document[]>("/documents/upload", form);
  return res.data;
};

export const getDocuments = async (params?: {
  skip?: number;
  limit?: number;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}): Promise<DocumentListResponse> => {
  const res = await api.get<DocumentListResponse>("/documents", { params });
  return res.data;
};

export const getDocument = async (id: string): Promise<Document> => {
  const res = await api.get<Document>(`/documents/${id}`);
  return res.data;
};

export const getProgress = async (id: string) => {
  const res = await api.get(`/documents/${id}/progress`);
  return res.data;
};

export const retryDocument = async (id: string): Promise<Document> => {
  const res = await api.post<Document>(`/documents/${id}/retry`);
  return res.data;
};

export const updateReview = async (id: string, reviewed_data: ExtractedData): Promise<Document> => {
  const res = await api.put<Document>(`/documents/${id}/review`, { reviewed_data });
  return res.data;
};

export const finalizeDocument = async (id: string): Promise<Document> => {
  const res = await api.post<Document>(`/documents/${id}/finalize`);
  return res.data;
};

export const exportDocument = (id: string, format: "json" | "csv") => {
  const baseUrl = (import.meta.env.VITE_API_URL || "") + "/api";
  window.open(`${baseUrl}/documents/${id}/export?format=${format}`, "_blank");
};

export const deleteDocument = async (id: string): Promise<{status: string, message: string}> => {
  const res = await api.delete(`/documents/${id}`);
  return res.data;
};
