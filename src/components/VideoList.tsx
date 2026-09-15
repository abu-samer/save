import React from "react";
import { VideoRecord } from "../types";
import { VideoCard } from "./VideoCard";
import { Film, RefreshCw, Shield, AlertCircle } from "lucide-react";

interface VideoListProps {
  videos: VideoRecord[];
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  onDeleteVideo: (id: string) => Promise<void>;
  onRefresh: () => void;
  onOpenAdmin: () => void;
}

export const VideoList: React.FC<VideoListProps> = ({
  videos,
  isLoading,
  error,
  isAdmin,
  onDeleteVideo,
  onRefresh,
  onOpenAdmin,
}) => {
  return (
    <section className="space-y-6" dir="rtl">
      {/* Feed Header & Counter */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-amber-400" />
          <h2 className="text-base sm:text-lg font-bold text-stone-200">
            ملفات الفيديوهات المتاحة للتنزيل
          </h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-stone-800 text-stone-300 border border-stone-700">
            {videos.length}
          </span>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="تحديث قائمة الفيديوهات"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-amber-400" : ""}`} />
          <span>تحديث</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={onRefresh}
            className="underline text-rose-200 hover:text-white font-semibold mr-2"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && videos.length === 0 && (
        <div className="bg-stone-900/60 border border-dashed border-stone-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
            <Film className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-stone-200 mb-2">لا توجد فيديوهات منشورة بعد</h3>
          <p className="text-xs text-stone-400 max-w-md mb-6 leading-relaxed">
            الموقع مخصص لرفع ومشاركة الفيديوهات بأقصى جودة ونقاوة أصلية بدون أي ضغط.
            فقط المشرف يمكنه نشر وحذف الفيديوهات.
          </p>
          {!isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-colors shadow-md"
            >
              <Shield className="w-4 h-4" />
              <span>تسجيل دخول المشرف لنشر الفيديوهات</span>
            </button>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && videos.length === 0 && (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4 animate-pulse"
            >
              <div className="h-6 bg-stone-800 rounded w-1/3" />
              <div className="h-4 bg-stone-800/60 rounded w-1/4" />
              <div className="aspect-video bg-stone-950 rounded-xl" />
              <div className="h-10 bg-stone-800 rounded-xl w-48 mr-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Videos List Under Each Other */}
      <div className="space-y-8">
        {videos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            isAdmin={isAdmin}
            onDelete={onDeleteVideo}
          />
        ))}
      </div>
    </section>
  );
};
