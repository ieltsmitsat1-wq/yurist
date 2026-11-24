"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { removeToken } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/leads", label: "Leadlar (CRM)", icon: "👥" },
  { href: "/chats", label: "Xabarlar (Inbox)", icon: "✉️" },
  { href: "/inquiries", label: "Tasdiqlash navbati", icon: "⚖️" },
  { href: "/services", label: "Xizmatlar", icon: "📋" },
  { href: "/transactions", label: "To'lovlar", icon: "💰" },
  { href: "/referrals", label: "Referral", icon: "🔗" },
  { href: "/helplines", label: "Ishonch Telefonlari", icon: "📞" },
  { href: "/channels", label: "Majburiy Obuna", icon: "📢" },
];

const BOTTOM_ITEMS = [
  { href: "/settings", label: "Sozlamalar", icon: "⚙️" },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    removeToken();
    if (onClose) onClose();
    router.replace("/login");
  };

  return (
    <aside className="group w-full bg-white border-r border-slate-200 flex flex-col shrink-0 h-full overflow-hidden">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">⚖️</span>
          </div>
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-lg font-bold text-slate-900 md:opacity-0 md:invisible transition-all duration-200 md:group-hover:max-w-20 md:group-hover:opacity-100 md:group-hover:visible">
            Yurist
          </span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-[10px] bg-indigo-100 text-indigo-700 px-0 py-0 rounded font-semibold tracking-wide uppercase md:opacity-0 md:invisible transition-all duration-200 md:group-hover:max-w-14 md:group-hover:px-1.5 md:group-hover:py-0.5 md:group-hover:opacity-100 md:group-hover:visible">
            Admin
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        <div className="px-3 mb-3 md:opacity-0 md:invisible whitespace-nowrap transition-all duration-200 md:group-hover:opacity-100 md:group-hover:visible">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Asosiy</span>
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              title={item.label}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span className="whitespace-nowrap md:opacity-0 md:invisible transition-opacity duration-200 md:group-hover:opacity-100 md:group-hover:visible">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3 space-y-0.5 shrink-0">
        <div className="border-t border-slate-200 pt-3 space-y-1">
          {BOTTOM_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                title={item.label}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="whitespace-nowrap md:opacity-0 md:invisible transition-opacity duration-200 md:group-hover:opacity-100 md:group-hover:visible">
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-all text-left cursor-pointer"
          >
            <span className="text-base w-5 text-center">🚪</span>
            <span className="whitespace-nowrap md:opacity-0 md:invisible transition-opacity duration-200 md:group-hover:opacity-100 md:group-hover:visible">
              Chiqish
            </span>
          </button>
        </div>
      </div>

      <div className="px-4 py-4 border-t border-slate-200 bg-slate-50/50 shrink-0">
        <div className="text-[11px] text-slate-400 font-medium whitespace-nowrap md:opacity-0 md:invisible transition-opacity duration-200 md:group-hover:opacity-100 md:group-hover:visible">
          Yurist LegalTech v1.0
        </div>
      </div>
    </aside>
  );
}
