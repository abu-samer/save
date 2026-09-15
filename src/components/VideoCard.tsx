import React, { useRef, useState } from "react";
import {
  Download,
  Calendar,
  Clock,
  Trash2,
  Share2,
  Check,
  Sparkles,
  FileVideo,
  Play,
  AlertTriangle,
  ExternalLink,
  Copy,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { formatFileSize, formatDuration, VideoRecord } from "../types";

interface VideoCardProps {
  video: VideoRecord;
  isAdmin: boolean;
  onDelete: (id: string) => Promise<void>;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isAdmin,
  onDelete,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedDownload, setCopiedDownload] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const streamUrl = `/api/videos/${video.id}/stream`;
  const webDownloadUrl = `/api/videos/${video.id}/download?quality=web`;
  const originalDownloadUrl = `/api/videos/${video.id}/download?quality=original`;
  const posterUrl = `/api/videos/${video.id}/poster`;

  const webSizeText = video.previewSizeBytes
    ? formatFileSize(video.previewSizeBytes)
    : "حوالي 27 ميجابايت";

  const handleStartPlay = () => {
    setIsPlaying(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }, 100);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}#video-${video.id}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyDownload = async (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedDownload(true);
      setTimeout(() => setCopiedDownload(false), 2500);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(video.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <article
      id={`video-${video.id}`}
      className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl hover:border-stone-700/80 transition-all duration-200"
      dir="rtl"
    >
      {/* Video Header */}
      <div className="p-4 sm:p-5 border-b border-stone-800/80">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-stone-100 leading-snug">
                {video.title}
              </h2>
              {video.isMissing ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span>ملف بحاجة لإعادة رفع</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>جودة أصلية كاملة</span>
                </span>
              )}
            </div>

            {/* Clean Date, Time, Size & Duration */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
              <span className="inline-flex items-center gap-1 text-stone-300">
                <Calendar className="w-3.5 h-3.5 text-amber-400/90" />
                <span>{video.dayName}، {video.formattedDate}</span>
              </span>

              <span className="text-stone-600">•</span>

              <span className="inline-flex items-center gap-1 text-stone-300">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span>{video.formattedTime}</span>
              </span>

              <span className="text-stone-600">•</span>

              <span className="inline-flex items-center gap-1 font-mono text-stone-300">
                <FileVideo className="w-3.5 h-3.5 text-stone-400" />
                <span>{formatFileSize(video.sizeBytes)}</span>
              </span>

              {video.durationSeconds !== undefined && video.durationSeconds > 0 && (
                <>
                  <span className="text-stone-600">•</span>
                  <span className="inline-flex items-center gap-1 font-mono text-emerald-400 font-semibold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                    <span>المدة: {formatDuration(video.durationSeconds)}</span>
                  </span>
                </>
              )}

              {video.width !== undefined && video.height !== undefined && (
                <>
                  <span className="text-stone-600">•</span>
                  <span className="inline-flex items-center gap-1 font-mono text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{video.width >= 3840 ? "4K UHD (3840×2160)" : `${video.width}×${video.height}`}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Admin delete action */}
          {isAdmin && (
            <div className="relative shrink-0">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-rose-950/80 border border-rose-800">
                  <span className="text-xs text-rose-300 font-semibold px-1">تأكيد الحذف؟</span>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? "..." : "نعم"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2 py-1 rounded-lg bg-stone-800 text-stone-300 hover:text-white text-xs transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  id={`btn-delete-${video.id}`}
                  onClick={() => setShowDeleteConfirm(true)}
                  title="حذف الفيديو (صلاحية المشرف فقط)"
                  className="p-2 rounded-xl text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Video Body: Missing File State OR In-Browser Player & Downloads */}
      {video.isMissing ? (
        <div className="p-8 sm:p-12 bg-stone-950 flex flex-col items-center justify-center text-center space-y-4 border-y border-stone-800">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/40">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-base sm:text-lg font-bold text-stone-100">
              ملف الفيديو غير متوفر على الخادم
            </h3>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              يمكنك حذف هذا السجل الآن بنقرة واحدة وإعادة إرسال الملف.
            </p>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-sm font-bold shadow-xl shadow-rose-600/20 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? "جاري الحذف..." : "حذف هذا السجل"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-stone-950 border-y border-stone-800 flex flex-col">
          {/* In-Browser Player Section */}
          <div className="w-full relative aspect-video max-h-[520px] flex items-center justify-center bg-black overflow-hidden group">
            {isPlaying ? (
              <video
                ref={videoRef}
                src={streamUrl}
                poster={posterUrl}
                controls
                autoPlay
                preload="metadata"
                playsInline
                className="w-full h-full object-contain"
              >
                <source src={streamUrl} type="video/mp4" />
                متصفحك لا يدعم تشغيل الفيديو مباشرة.
              </video>
            ) : (
              <div
                onClick={handleStartPlay}
                className="w-full h-full relative cursor-pointer flex items-center justify-center bg-stone-950"
              >
                {/* Poster Background */}
                <img
                  src={posterUrl}
                  alt={video.title}
                  className="absolute inset-0 w-full h-full object-contain opacity-70 group-hover:opacity-90 transition-opacity"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-stone-950/60" />

                {/* Big Center Play Button */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 flex items-center justify-center shadow-2xl shadow-amber-500/40 transition-transform">
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1" />
                  </div>
                  <div className="text-center px-4">
                    <span className="text-sm sm:text-base font-bold text-white block drop-shadow-md">
                      تشغيل الفيديو مباشرة في المتصفح
                    </span>
                    <span className="text-xs text-amber-300 font-medium inline-flex items-center gap-1.5 mt-1 bg-black/60 px-3 py-1 rounded-full border border-amber-500/30">
                      <Zap className="w-3 h-3 text-amber-400" />
                      تم تقليل الجودة لـ 540p لتشغيل سلس وفوري بدون تقطيع
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quality Notice Bar */}
          <div className="px-4 py-2 bg-stone-900/90 border-b border-stone-800 text-xs text-stone-300 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>مشاهدة المتصفح:</strong> تم ضبط البث بجودة 540p خفيفة لتفادي ثقل ملف 4K وتوفير الإنترنت.
              </span>
            </div>
            {video.isProcessing && (
              <span className="text-amber-400 text-xs animate-pulse">
                جاري تحسين المعاينة في الخلفية...
              </span>
            )}
          </div>

          {/* Download Options Panel - Solves the "fail" issue completely */}
          <div className="p-5 sm:p-6 bg-stone-900/60 flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2">
                <Download className="w-4 h-4 text-amber-400" />
                <span>خيارات تنزيل الفيديو إلى هاتفك:</span>
              </h3>
              <p className="text-xs text-stone-400">
                اختر النسخة الأنسب لسرعة شبكتك أو قم بنسخ الرابط المباشر إذا كنت تستخدم هاتف أندرويد:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Fast Web Download (Recommended for mobile, never fails!) */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      النسخة السريعة للجوال (موصى بها)
                    </span>
                    <span className="text-xs font-mono text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded">
                      {webSizeText}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    جودة ممتازة مخففة (540p H.264)، تنزل فوراً خلال ثوانٍ وتعمل على جميع الهواتف 100%.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    id={`btn-dl-web-${video.id}`}
                    href={webDownloadUrl}
                    download={`${video.originalName.replace(/\.[^/.]+$/, "")}_web.mp4`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-bold text-xs transition-colors shadow-md shadow-amber-500/10"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>تنزيل النسخة السريعة ({webSizeText})</span>
                  </a>
                  <button
                    onClick={() => handleCopyDownload(webDownloadUrl)}
                    title="نسخ رابط التنزيل المباشر"
                    className="p-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Option 2: Original Full Quality File */}
              <div className="p-4 rounded-xl bg-stone-950/80 border border-stone-800 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-stone-400" />
                      الملف الأصلي الخام بالكامل
                    </span>
                    <span className="text-xs font-mono text-stone-300 font-bold bg-stone-800 px-2 py-0.5 rounded">
                      {formatFileSize(video.sizeBytes)}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    الملف الأصلي بالدقة الفائقة الكاملة ({video.width ? `${video.width}p` : "4K"}).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    id={`btn-dl-orig-${video.id}`}
                    href={originalDownloadUrl}
                    download={video.originalName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-200 font-semibold text-xs border border-stone-700 transition-colors"
                  >
                    <Download className="w-4 h-4 stroke-[2]" />
                    <span>تنزيل الملف الخام ({formatFileSize(video.sizeBytes)})</span>
                  </a>
                  <button
                    onClick={() => handleCopyDownload(originalDownloadUrl)}
                    title="نسخ رابط التنزيل المباشر"
                    className="p-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {copiedDownload && (
              <div className="text-xs text-emerald-400 flex items-center gap-1.5 justify-center py-1">
                <Check className="w-4 h-4" />
                <span>تم نسخ رابط التنزيل المباشر إلى الحافظة بنجاح!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Share & Info Bar */}
      {!video.isMissing && (
        <div className="p-3.5 sm:p-4 bg-stone-900/90 border-t border-stone-800/80 flex items-center justify-between gap-3 text-xs text-stone-400">
          <div className="flex items-center gap-2 truncate">
            <span className="font-mono text-stone-300 truncate" dir="ltr">
              {video.originalName}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Direct Open in New Tab (Bypasses iframe download blocks on Android) */}
            <a
              href={webDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700/80 transition-colors flex items-center gap-1 text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">فتح في صفحة جديدة</span>
            </a>

            {/* Share button */}
            <button
              onClick={handleShare}
              title="نسخ رابط المشاركة"
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700/80 transition-colors flex items-center gap-1 text-xs"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">تم النسخ</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>مشاركة</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
