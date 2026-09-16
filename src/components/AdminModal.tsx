import React, { useState } from "react";
import { Shield, Lock, X, KeyRound, AlertCircle, Eye, EyeOff } from "lucide-react";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (password: string) => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("الرجاء إدخال كلمة السر");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          onSuccess(password.trim());
          setPassword("");
          onClose();
          return;
        } else {
          setError(data.message || "كلمة السر غير صحيحة");
          return;
        }
      } else {
        // Server returned non-200 (e.g. 404 on GitHub Pages)
        throw new Error("Server not available");
      }
    } catch (err) {
      // Offline / Static fallback (for GitHub Pages)
      if (password.trim() === "123456789") {
        onSuccess(password.trim());
        setPassword("");
        onClose();
        return;
      } else {
        setError("كلمة السر غير صحيحة (المحددة هي 123456789)");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickKey = (num: number) => {
    if (password.length < 15) {
      setPassword((prev) => prev + num.toString());
      setError(null);
    }
  };

  return (
    <div
      id="admin-auth-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        id="admin-auth-modal"
        className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-2xl text-stone-100"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Close Button */}
        <button
          id="btn-close-modal"
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center pt-2 pb-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-stone-100">دخول المشرف (الأدمن)</h2>
          <p className="text-xs text-stone-400 mt-1">
            صلاحيات المشرف تتيح لك رفع فيديوهات جديدة وحذف المقاطع
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1.5">
              كلمة السر (من 1 إلى 9)
            </label>
            <div className="relative">
              <input
                id="input-admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="أدخل كلمة السر هنا..."
                className="w-full pl-10 pr-4 py-3 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono text-sm tracking-widest"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              ملاحظة: كلمة السر المحددة هي الأرقام من 1 لـ 9 بالترتيب (123456789)
            </p>
          </div>

          {/* Quick numeric buttons 1 to 9 */}
          <div className="bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/80">
            <div className="text-[11px] text-stone-400 mb-2 flex items-center justify-between">
              <span>أزرار سريعة للأرقام (1-9):</span>
              <button
                type="button"
                onClick={() => setPassword("")}
                className="text-[10px] text-amber-400 hover:underline"
              >
                مسح
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleQuickKey(num)}
                  className="py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-800 text-sm font-semibold active:bg-amber-500/20 active:border-amber-500/40 transition-colors"
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              id="btn-submit-admin"
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              {isLoading ? "جاري التحقق..." : "تأكيد الدخول"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-semibold transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
