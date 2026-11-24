"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { approveInquiry, getInquiries, type Inquiry } from "@/lib/api";
import { formatDate, getStatusColor } from "@/lib/utils";

type QueueFilter = "queue" | "high" | "audit" | "approved";

const QUEUE_TABS: { value: QueueFilter; label: string }[] = [
  { value: "queue", label: "Tasdiqlash navbati" },
  { value: "high", label: "Yuqori xavf" },
  { value: "audit", label: "Hujjat auditlari" },
  { value: "approved", label: "Tasdiqlangan" },
];

export default function InquiriesPage() {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [filter, setFilter] = useState<QueueFilter>("queue");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === "approved" ? "approved" : undefined;
      const data = await getInquiries(undefined, 100, status);
      setInquiries(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function handleApprove(id: number) {
    setSavingId(id);
    try {
      await approveInquiry(id, editText);
      setInquiries((previous) =>
        previous.map((item) =>
          item.id === id
            ? { ...item, status: "approved", final_response: editText }
            : item
        )
      );
      setEditingId(null);
      setEditText("");
    } catch (error) {
      console.error(error);
    } finally {
      setSavingId(null);
    }
  }

  function getRiskBadge(level: string | null) {
    if (!level || level === "none") {
      return <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Xavf belgilanmagan</span>;
    }
    const styles: Record<string, string> = {
      low: "border-emerald-200 bg-emerald-50 text-emerald-700",
      medium: "border-amber-200 bg-amber-50 text-amber-700",
      high: "border-red-200 bg-red-50 text-red-700",
    };
    const labels: Record<string, string> = {
      low: "Past xavf",
      medium: "O'rta xavf",
      high: "Yuqori xavf",
    };
    return (
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[level] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
        {labels[level] || level}
      </span>
    );
  }

  const visibleInquiries = inquiries.filter((item) => {
    if (filter === "approved") return item.status === "approved";
    if (filter === "high") return item.risk_level === "high";
    if (filter === "audit") {
      return (
        item.question_text?.toLowerCase().includes("express audit") ||
        item.detected_category === "audit" ||
        item.ai_upsell_offer?.toLowerCase().includes("audit")
      );
    }
    return item.status !== "approved";
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Tasdiqlash navbati</h1>
          <p className="mt-1 text-sm text-slate-500">
            Advokat tasdig‘ini kutayotgan yuridik ishlar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{visibleInquiries.length} ta ish</span>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
        {QUEUE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold ${
              filter === tab.value
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Ishlar yuklanmoqda...</p>
        </div>
      ) : visibleInquiries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-sm text-slate-500">Bu bo‘limda ishlar yo‘q</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleInquiries.map((item) => {
            const isApproved = item.status === "approved";
            const isEditing = editingId === item.id;
            const draft = item.ai_draft_response || item.final_response;
            return (
              <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">#{item.id}</span>
                    {getRiskBadge(item.risk_level)}
                    {item.risk_score !== null && (
                      <span className="text-[10px] font-semibold text-slate-500">
                        Xavf balli: {item.risk_score}/100
                      </span>
                    )}
                    {item.channel && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {item.channel === "instagram" ? "Instagram" : "Telegram"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusColor(item.status)}`}>
                      {isApproved ? "Tasdiqlangan" : "Ko‘rib chiqilmoqda"}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatDate(item.created_at)}</span>
                  </div>
                </div>

                <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)] md:px-5">
                  <div className="min-w-0">
                    <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Mijoz murojaati
                    </h2>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                      {item.question_text || item.stt_transcript || "Murojaat matni mavjud emas"}
                    </p>
                    {item.detected_category && (
                      <p className="mt-3 text-[11px] text-slate-500">
                        Yo‘nalish: <strong className="text-slate-700">{item.detected_category}</strong>
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                      {isApproved ? "Tasdiqlangan javob" : "AI javob loyihasi"}
                    </h2>
                    {isEditing ? (
                      <textarea
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
                        rows={7}
                        className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                        {isApproved ? item.final_response : draft || "Javob loyihasi mavjud emas"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 md:px-5">
                  <button
                    type="button"
                    onClick={() => router.push(`/chats?userId=${item.user_id}`)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Inboxda ochish
                  </button>
                  {!isApproved && (
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditText("");
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                          >
                            Bekor qilish
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(item.id)}
                            disabled={savingId === item.id || !editText.trim()}
                            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {savingId === item.id ? "Saqlanmoqda..." : "Tasdiqlash"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditText(draft || "");
                          }}
                          className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          Javobni ko‘rib chiqish va tasdiqlash
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
