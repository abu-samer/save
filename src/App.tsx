import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { AdminModal } from "./components/AdminModal";
import { VideoUploader } from "./components/VideoUploader";
import { VideoList } from "./components/VideoList";
import { VideoRecord } from "./types";
import { Sparkles, Shield, AlertTriangle } from "lucide-react";

export default function App() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch videos from database API
  const fetchVideos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/videos");
      if (!res.ok) {
        throw new Error("تعذر جلب قائمة الفيديوهات من الخادم");
      }
      const data = await res.json();
      setVideos(data);
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تحميل الفيديوهات");
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
    setVideos((prev) => [newVideo, ...prev]);
  };

  const handleDeleteVideo = async (id: string) => {
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
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 text-xs sm:text-sm text-stone-300 flex items-start gap-3 shadow-sm">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="leading-relaxed">
            <span className="font-bold text-amber-300 block mb-0.5">
              موقع تنزيل ملفات الفيديو بالجودة الأصلية 100%
            </span>
            يقوم المشرف برفع ملف الفيديو بأي حجم (600 ميجا، 800 ميجا وأكثر) كملف أصلي، ويقوم الزوار بتنزيل ملف MP4 مباشرة إلى أجهزتهم وفتحه في مشغل الجوال بالدقة الكاملة بدون أي ضغط.
          </div>
        </div>

        {/* Video Uploader Form (Visible only for Admin) */}
        {isAdmin && (
          <VideoUploader
            adminPassword={adminPassword}
            onVideoUploaded={handleVideoUploaded}
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
