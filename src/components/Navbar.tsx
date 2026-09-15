import React from "react";
import { Shield, ShieldCheck, LogOut, Film } from "lucide-react";

interface NavbarProps {
  isAdmin: boolean;
  onOpenAdminModal: () => void;
  onLogoutAdmin: () => void;
  videoCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdmin,
  onOpenAdminModal,
  onLogoutAdmin,
  videoCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-stone-900/90 backdrop-blur-md border-b border-stone-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shadow-amber-500/10">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-stone-100 tracking-tight">
                منصة تنزيل الفيديوهات بالجودة الكاملة
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                100% ملفات أصلية
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              تنزيل ملف الفيديو كما هو لفتحه في مشغل هاتفك بأعلى دقة
            </p>
          </div>
        </div>

        {/* Right Corner Admin Shield Button */}
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>المشرف نشط</span>
              </div>
              <button
                id="btn-admin-logout"
                onClick={onLogoutAdmin}
                title="تسجيل الخروج من لوحة الإدارة"
                className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-rose-400 transition-colors border border-stone-700/80"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              id="btn-admin-shield"
              onClick={onOpenAdminModal}
              title="دخول المشرف (الأدمن)"
              className="group relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-600/10 hover:from-amber-500/25 hover:to-amber-600/20 text-amber-300 border border-amber-500/30 hover:border-amber-400/50 transition-all shadow-sm"
            >
              <Shield className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">لوحة الإدارة</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
