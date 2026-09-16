import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { AdminModal } from "./components/AdminModal";
import { VideoUploader } from "./components/VideoUploader";
import { VideoList } from "./components/VideoList";
import { VideoRecord } from "./types";
import { Sparkles, Globe } from "lucide-react";

// Default starter video for GitHub Pages mode (High reliability CDN with full CORS)
const DEFAULT_STATIC_VIDEOS: VideoRecord[] = [
  {
    id: "vid_demo_sample",
    title: "عرض تجريبي بدقة عالية 4K (Demo Video)",
    filename: "sample_4k_demo.mp4",
    originalName: "4K_High_Fidelity_Sample.mp4",
    mimeType: "video/mp4",
    sizeBytes: 154800000,
    createdAt: new Date().toISOString(),
    dayName: "اليوم",
    formattedDate: "فيديو جاهز للعرض",
    formattedTime: "مباشر",
    width: 3840,
    height: 2160,
    durationSeconds: 46,
    codec: "h264",
    bitrateMbps: 20.5,
    hasPreview: true,
    previewSizeBytes: 18500000,
    hasPoster: true,
    externalUrl: "https://vjs.zencdn.net/v/oceans.mp4",
  },
];

export default function App() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStaticMode, setIsStaticMode] = useState(false);

  // Admin authentication state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Load admin session from localStorage if present
  useEffect(() => {
    const savedPass = localStorage.getItem("app_admin_pass");
    if (savedPass === "123456789") {
      setIsAdmin(true);
      setAdminPassword(savedPass);
    }
  }, []);

  // Fetch videos from database API, with graceful GitHub Pages fallback
  const fetchVideos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/videos");
      if (!res.ok) {
        throw new Error("Server API not available");
      }
      const data = await res.json();
      setVideos(data);
      setIsStaticMode(false);
    } catch (err: any) {
      // Graceful fallback for GitHub Pages (Static Hosting)
      setIsStaticMode(true);
      const saved = localStorage.getItem("app_static_videos");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // If the cached demo video is the old googleapis bucket, update to reliable CDN
          const sanitized = parsed.map((v: VideoRecord) => {
            if (v.id === "vid_demo_sample" && v.externalUrl?.includes("commondatastorage.googleapis.com")) {
              return DEFAULT_STATIC_VIDEOS[0];
            }
            return v;
          });
          setVideos(sanitized.length > 0 ? sanitized : DEFAULT_STATIC_VIDEOS);
          localStorage.setItem("app_static_videos", JSON.stringify(sanitized));
        } catch (_) {
          setVideos(DEFAULT_STATIC_VIDEOS);
        }
      } else {
        setVideos(DEFAULT_STATIC_VIDEOS);
        localStorage.setItem("app_static_videos", JSON.stringify(DEFAULT_STATIC_VIDEOS));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleAdminSuccess = (password: string) => {
    setIsAdmin(true);
    setAdminPassword(password);
    localStorage.setItem("app_admin_pass", password);
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminPassword("");
    localStorage.removeItem("app_admin_pass");
  };

  const handleVideoUploaded = (newVideo: VideoRecord) => {
    setVideos((prev) => {
      const updated = [newVideo, ...prev];
      if (isStaticMode) {
        localStorage.setItem("app_static_videos", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleDeleteVideo = async (id: string) => {
    if (isStaticMode) {
      setVideos((prev) => {
        const updated = prev.filter((v) => v.id !== id);
        localStorage.setItem("app_static_videos", JSON.stringify(updated));
        return updated;
      });
      return;
    }

    try {
      const res = await fetch(`/api/videos/${id}`, {
        method: "DELETE",
        headers: {
          "x-admin-password": adminPassword || "123456789",
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "فشل حذف الفيديو");
      }

      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء محاولة الحذف");
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-['Cairo',sans-serif]">
      {/* Header */}
      <Navbar
        isAdmin={isAdmin}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onLogoutAdmin={handleAdminLogout}
        videoCount={videos.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Lossless Quality Announcement Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 text-xs sm:text-sm text-stone-300 flex items-start justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="leading-relaxed">
              <span className="font-bold text-amber-300 block mb-0.5">
                منصة تنزيل ومشاهدة الفيديوهات بالجودة الأصلية 100%
              </span>
              يمكن للزوار تشغيل الفيديو فوراً في المتصفح بنسخة مخففة، أو تنزيل ملف MP4 الأصلي الكامل بالدقة الفائقة مباشرة إلى الجوال.
            </div>
          </div>
          {isStaticMode && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900 border border-stone-700 text-stone-300 text-xs shrink-0">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>GitHub Pages</span>
            </span>
          )}
        </div>

        {/* Video Uploader Form (Visible only for Admin) */}
        {isAdmin && (
          <VideoUploader
            adminPassword={adminPassword}
            onVideoUploaded={handleVideoUploaded}
            isStaticMode={isStaticMode}
          />
        )}

        {/* List of Videos One Under Another */}
        <VideoList
          videos={videos}
          isLoading={isLoading}
          error={error}
          isAdmin={isAdmin}
          onDeleteVideo={handleDeleteVideo}
          onRefresh={fetchVideos}
          onOpenAdmin={() => setIsAdminModalOpen(true)}
        />
      </main>

      {/* Admin Password Modal (Shield Button) */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSuccess={handleAdminSuccess}
      />

      {/* Footer */}
      <footer className="border-t border-stone-800/80 bg-stone-900/60 py-6 mt-12 text-center text-xs text-stone-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>منصة الفيديوهات بالجودة الكاملة • حفظ وتنزيل بدون ضغط</span>
          <span className="font-mono text-stone-600 text-[11px]">Lossless High Fidelity Video Hub</span>
        </div>
      </footer>
    </div>
  );
}
