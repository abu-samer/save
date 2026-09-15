import React, { useState, useRef } from "react";
import { Upload, Film, CheckCircle2, AlertCircle, X, Sparkles, FileVideo } from "lucide-react";
import { formatFileSize, UploadProgressState, VideoRecord } from "../types";

interface VideoUploaderProps {
  adminPassword: string;
  onVideoUploaded: (video: VideoRecord) => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  adminPassword,
  onVideoUploaded,
}) => {
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadProgressState>({
    isUploading: false,
    progress: 0,
    loadedBytes: 0,
    totalBytes: 0,
    statusText: "",
    error: null,
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (file: File) => {
    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|mkv|webm|avi|flv|m4v|3gp)$/i)) {
      setUploadState((prev) => ({
        ...prev,
        error: "الرجاء اختيار ملف فيديو صالح (MP4, MOV, MKV, WebM...)",
      }));
      return;
    }
    setSelectedFile(file);
    if (!title) {
      // Pre-fill title without extension
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setTitle(baseName);
    }
    setUploadState((prev) => ({ ...prev, error: null }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunk size - bypasses proxy limits

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadState((prev) => ({ ...prev, error: "الرجاء اختيار ملف فيديو أولاً" }));
      return;
    }

    const file = selectedFile;
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const videoTitle = title.trim() || file.name.replace(/\.[^/.]+$/, "");

    setUploadState({
      isUploading: true,
      progress: 0,
      loadedBytes: 0,
      totalBytes: totalSize,
      statusText: `تهيئة رفع الفيديو (${formatFileSize(totalSize)} - مقسم إلى ${totalChunks} جزء لتجاوز حدود الشبكة)...`,
      error: null,
    });

    try {
      // 1. Initialize Chunked Upload
      const initRes = await fetch("/api/videos/upload/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          title: videoTitle,
          originalName: file.name,
          totalSize,
          totalChunks,
          mimeType: file.type || "video/mp4",
        }),
      });

      if (!initRes.ok) {
        const errJson = await initRes.json().catch(() => ({}));
        throw new Error(errJson.error || "فشل تهيئة جلسة الرفع");
      }

      const { uploadId } = await initRes.json();

      // 2. Upload Chunks Sequentially with Progress and Retry
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunkBlob = file.slice(start, end);

        let chunkUploaded = false;
        let attempts = 0;

        while (!chunkUploaded && attempts < 5) {
          attempts++;
          try {
            await new Promise<void>((resolve, reject) => {
              const formData = new FormData();
              formData.append("chunk", chunkBlob, `part_${chunkIndex}`);

              const xhr = new XMLHttpRequest();

              xhr.upload.onprogress = (evt) => {
                if (evt.lengthComputable) {
                  const currentLoaded = start + evt.loaded;
                  const percent = Math.min(98, Math.round((currentLoaded / totalSize) * 100));
                  setUploadState({
                    isUploading: true,
                    progress: percent,
                    loadedBytes: currentLoaded,
                    totalBytes: totalSize,
                    statusText: `جاري رفع الجزء ${chunkIndex + 1} من ${totalChunks} (${percent}%) • ${formatFileSize(currentLoaded)} من ${formatFileSize(totalSize)}`,
                    error: null,
                  });
                }
              };

              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve();
                } else {
                  reject(new Error(`فشل رفع الجزء ${chunkIndex + 1} (رمز: ${xhr.status})`));
                }
              };

              xhr.onerror = () => reject(new Error(`انقطع الاتصال أثناء رفع الجزء ${chunkIndex + 1}`));

              xhr.open("POST", "/api/videos/upload/chunk");
              xhr.setRequestHeader("x-admin-password", adminPassword);
              xhr.setRequestHeader("x-upload-id", uploadId);
              xhr.setRequestHeader("x-chunk-index", chunkIndex.toString());
              xhr.setRequestHeader("x-total-chunks", totalChunks.toString());
              xhr.send(formData);
            });

            chunkUploaded = true;
          } catch (chunkErr) {
            if (attempts >= 5) {
              throw chunkErr;
            }
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
      }

      // 2.5 Verify and re-upload any missing parts before final stitch
      setUploadState((prev) => ({
        ...prev,
        progress: 98,
        statusText: "جاري التحقق من وصول كامل الأجزاء للخادم بدون أي نقص...",
      }));

      const checkRes = await fetch(`/api/videos/upload/check/${uploadId}?totalChunks=${totalChunks}`, {
        headers: { "x-admin-password": adminPassword },
      });

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.missing && checkData.missing.length > 0) {
          // Re-upload missing parts
          for (const mIndex of checkData.missing) {
            setUploadState((prev) => ({
              ...prev,
              statusText: `إعادة إرسال الجزء ${mIndex + 1} المفقود لضمان سلامة الملف...`,
            }));
            const start = mIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, totalSize);
            const chunkBlob = file.slice(start, end);
            const formData = new FormData();
            formData.append("chunk", chunkBlob, `part_${mIndex}`);

            await fetch("/api/videos/upload/chunk", {
              method: "POST",
              headers: {
                "x-admin-password": adminPassword,
                "x-upload-id": uploadId,
                "x-chunk-index": mIndex.toString(),
                "x-total-chunks": totalChunks.toString(),
              },
              body: formData,
            });
          }
        }
      }

      // 3. Complete and Stitch All Chunks
      setUploadState((prev) => ({
        ...prev,
        progress: 99,
        statusText: "اكتمل الرفع! جاري حفظ ملف الفيديو بالجودة الأصلية وتجهيزه للتنزيل المباشر...",
      }));

      const completeRes = await fetch("/api/videos/upload/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          uploadId,
          title: videoTitle,
          originalName: file.name,
          mimeType: file.type || "video/mp4",
          totalChunks,
        }),
      });

      if (!completeRes.ok) {
        const completeErr = await completeRes.json().catch(() => ({}));
        throw new Error(completeErr.error || "فشل تجميع أجزاء الفيديو");
      }

      const newVideo: VideoRecord = await completeRes.json();

      setUploadState({
        isUploading: false,
        progress: 100,
        loadedBytes: totalSize,
        totalBytes: totalSize,
        statusText: "تم النشر بنجاح بالجودة الكاملة 100%!",
        error: null,
      });

      onVideoUploaded(newVideo);
      setSelectedFile(null);
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setUploadState((prev) => ({
        ...prev,
        isUploading: false,
        error: err.message || "حدث خطأ أثناء رفع الفيديو",
      }));
    }
  };

  return (
    <div
      id="video-uploader-card"
      className="bg-stone-900 border-2 border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl mb-8 relative overflow-hidden"
      dir="rtl"
    >
      <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-100">
              إرسال ملف فيديو للتنزيل (لوحة المشرف)
            </h2>
            <p className="text-xs text-stone-400">
              يُحفظ ملف MP4 بالأصل كما هو (600MB أو 800MB+) ليقوم الزوار بتنزيله وفتحه بهواتفهم
            </p>
          </div>
        </div>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
          صلاحية المشرف
        </span>
      </div>

      <form onSubmit={handleUpload} className="space-y-4">
        {/* Title input */}
        <div>
          <label className="block text-xs font-semibold text-stone-300 mb-1.5">
            عنوان الفيديو:
          </label>
          <input
            id="input-video-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: مقطع الرحلة بجودة 4K أو لقطة مميزة..."
            disabled={uploadState.isUploading}
            className="w-full px-4 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm"
          />
        </div>

        {/* Drag and drop area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => {
            if (!uploadState.isUploading && fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragOver
              ? "border-amber-400 bg-amber-500/10"
              : selectedFile
              ? "border-emerald-500/40 bg-emerald-950/20"
              : "border-stone-800 hover:border-stone-700 bg-stone-950/50 hover:bg-stone-950"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.mov,.mkv,.webm,.avi"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelection(e.target.files[0]);
              }
            }}
          />

          {selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <FileVideo className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-stone-100">{selectedFile.name}</div>
              <div className="text-xs text-emerald-400 font-mono">
                الحجم: {formatFileSize(selectedFile.size)} • الجودة الأصلية الخام
              </div>
              <p className="text-[11px] text-stone-400 mt-1">انقر للتغيير أو اسحب ملفاً آخر</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-stone-800/80 border border-stone-700 flex items-center justify-center text-stone-400">
                <Film className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-stone-200">
                انقر لاختيار فيديو من جهازك، أو اسحبه هنا
              </div>
              <p className="text-xs text-stone-500">
                يدعم كافة الصيغ بدقة كاملة (MP4, MOV, MKV, WebM, 4K, 1080p...)
              </p>
            </div>
          )}
        </div>

        {/* Quality commitment & Chunked Upload note */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-stone-950 border border-amber-500/20 text-xs text-stone-300">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-300 block">
              نظام الرفع المجزأ (يدعم 800MB و 1GB و 2GB+ بجودة 4K كاملة):
            </span>
            <span className="text-stone-400 leading-relaxed block">
              يتم تقسيم الفيديوهات الكبيرة وتمريرها تلقائياً بدون انقطاع لتجاوز حدود الشبكة، وتُجمّع على السيرفر بنفس البايت الأصلي 100% دون أي معالجة أو ضغط لتضمن الحصول على كامل النقاء والوضوح.
            </span>
          </div>
        </div>

        {/* Upload Progress Bar */}
        {uploadState.isUploading && (
          <div className="space-y-2 p-3.5 bg-stone-950 rounded-xl border border-stone-800">
            <div className="flex justify-between text-xs text-stone-300 font-semibold">
              <span>{uploadState.statusText}</span>
              <span className="font-mono text-amber-400">{uploadState.progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-150"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {uploadState.error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadState.error}</span>
          </div>
        )}

        {/* Submit button */}
        <button
          id="btn-upload-video"
          type="submit"
          disabled={!selectedFile || uploadState.isUploading}
          className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
        >
          <Upload className="w-4 h-4" />
          {uploadState.isUploading ? "جاري رفع الفيديو..." : "نشر الفيديو بالجودة الكاملة"}
        </button>
      </form>
    </div>
  );
};
