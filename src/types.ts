export interface VideoRecord {
  id: string;
  title: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  dayName: string;
  formattedDate: string;
  formattedTime: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  codec?: string;
  bitrateMbps?: number;
  hasPreview?: boolean;
  previewSizeBytes?: number;
  hasPoster?: boolean;
  isProcessing?: boolean;
  isMissing?: boolean;
  externalUrl?: string;
}

export interface UploadProgressState {
  isUploading: boolean;
  progress: number;
  loadedBytes: number;
  totalBytes: number;
  statusText: string;
  error?: string | null;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 بايت";
  const k = 1024;
  const sizes = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${val} ${sizes[i]}`;
}

export function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
