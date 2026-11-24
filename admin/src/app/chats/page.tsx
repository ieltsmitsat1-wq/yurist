"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  getDialogs,
  getMessages,
  getReceiptImageBlob,
  getTransactions,
  sendLawyerMessage,
  updateLeadProfile,
  type Dialog,
  type ChatMessageItem as Message,
  type Transaction,
} from "@/lib/api";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";

const LEAD_STATUSES = [
  { value: "new", label: "Yangi" },
  { value: "need_call", label: "Telefon qilish kerak" },
  { value: "paid", label: "To‘lov qilgan" },
  { value: "service_purchased", label: "Xizmat sotib olgan" },
  { value: "verified_lead", label: "Tasdiqlangan" },
  { value: "express_audit", label: "Express audit" },
  { value: "proposal_sent", label: "Taklif yuborildi" },
  { value: "appointment_booked", label: "Uchrashuv belgilandi" },
  { value: "in_progress", label: "Jarayonda" },
  { value: "completed", label: "Tugallandi" },
  { value: "closed_won", label: "Muvaffaqiyatli" },
  { value: "lost", label: "Yo‘qotildi" },
] as const;

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Tasdiqlash kutilmoqda",
  completed: "Tasdiqlangan",
  failed: "Tasdiqlanmagan",
  refunded: "Qaytarilgan",
  fulfilled: "Xizmat bajarilgan",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  telegram_stars: "Telegram Stars",
  stars: "Telegram Stars",
  p2p_card: "Chek / karta",
  payme: "Payme",
  click: "Click",
};

export default function ChatsPage() {
  const searchParams = useSearchParams();
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [receiptUrls, setReceiptUrls] = useState<Record<number, string>>({});
  const [replyText, setReplyText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | "telegram" | "instagram">("all");
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileStatus, setProfileStatus] = useState("new");
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingDialogs, setLoadingDialogs] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function fetchDialogs() {
    try {
      const data = await getDialogs();
      setDialogs(data || []);
    } catch (error) {
      console.error("Failed to fetch dialogs:", error);
    } finally {
      setLoadingDialogs(false);
    }
  }

  async function fetchDialogsSilently() {
    try {
      const data = await getDialogs();
      if (data) {
        setDialogs(data);
      }
    } catch (error) {
      console.debug("Silent dialog poll failed:", error);
    }
  }

  async function fetchTransactions() {
    try {
      const data = await getTransactions(undefined, 200);
      setTransactions(data || []);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoadingTransactions(false);
    }
  }

  async function fetchMessages(userId: number) {
    setLoadingMessages(true);
    try {
      const data = await getMessages(userId);
      setMessages(data || []);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function fetchMessagesSilently(userId: number) {
    try {
      const data = await getMessages(userId);
      if (data) {
        setMessages((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(data)) {
            return data;
          }
          return prev;
        });
      }
    } catch (error) {
      console.debug("Silent messages poll failed:", error);
    }
  }

  const handleSelectUser = (userId: number) => {
    const dialog = dialogs.find((item) => item.user_id === userId);
    if (dialog) {
      setProfileName(dialog.full_name || "");
      setProfilePhone(dialog.phone_number || "");
      setProfileStatus(dialog.lead_status || "new");
    }
    setSelectedUserId(userId);
    setShowMessages(true);
    fetchMessages(userId);
  };

  async function handleSaveProfile() {
    if (!selectedUserId) return;
    setSavingProfile(true);
    try {
      const saved = await updateLeadProfile(selectedUserId, {
        full_name: profileName.trim(),
        phone_number: profilePhone.trim(),
        lead_status: profileStatus,
      });
      setDialogs((previous) =>
        previous.map((dialog) =>
          dialog.user_id === selectedUserId
            ? {
                ...dialog,
                full_name: saved.full_name || "Mijoz",
                phone_number: saved.phone_number,
                lead_status: saved.lead_status,
              }
            : dialog
        )
      );
    } catch (error) {
      console.error("Failed to update customer profile:", error);
    } finally {
      setSavingProfile(false);
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !replyText.trim()) return;

    setSending(true);
    try {
      const newMessage = await sendLawyerMessage(selectedUserId, replyText);
      setMessages((prev) => [...prev, newMessage]);
      setReplyText("");
      setDialogs((prev) =>
        prev
          .map((d) =>
            d.user_id === selectedUserId
              ? {
                  ...d,
                  last_message: newMessage.text,
                  last_sender: "lawyer",
                  last_time: newMessage.created_at,
                  total_messages: d.total_messages + 1,
                }
              : d
          )
          .sort(
            (a, b) =>
              new Date(b.last_time || 0).getTime() - new Date(a.last_time || 0).getTime()
          )
      );
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void fetchDialogs();
      const requestedUserId = Number(searchParams.get("userId"));
      if (requestedUserId > 0) {
        setSelectedUserId(requestedUserId);
        setShowMessages(true);
        void fetchMessages(requestedUserId);
      }
      void fetchTransactions();
    }, 0);
    const timer = setInterval(() => {
      fetchDialogsSilently();
    }, 5000);
    return () => {
      window.clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    const receiptMessages = messages.filter(
      (message) => message.message_type === "photo" && message.media_url
    );
    const objectUrls: string[] = [];

    async function loadReceiptImages() {
      const loaded = await Promise.all(
        receiptMessages.map(async (message) => {
          try {
            const blob = await getReceiptImageBlob(message.user_id, message.id);
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            return [message.id, url] as const;
          } catch (error) {
            console.error("Failed to load receipt image:", error);
            return null;
          }
        })
      );
      if (!cancelled) {
        setReceiptUrls(Object.fromEntries(loaded.filter(Boolean) as [number, string][]));
      }
    }

    void loadReceiptImages();
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [messages]);

  useEffect(() => {
    if (!selectedUserId) return;
    const timer = setInterval(() => {
      fetchMessagesSilently(selectedUserId);
    }, 4000);
    return () => clearInterval(timer);
  }, [selectedUserId]);

  const selectedDialog = dialogs.find((d) => d.user_id === selectedUserId);
  const selectedTransactions = transactions
    .filter((transaction) => transaction.user_id === selectedUserId)
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  const receiptSubmitted = messages.some(
    (message) =>
      message.message_type === "photo" ||
      message.text?.toLowerCase().includes("to'lov cheki") ||
      message.text?.toLowerCase().includes("to‘lov cheki")
  );
  const latestReceiptMessage = [...messages]
    .reverse()
    .find((message) => message.message_type === "photo" && message.media_url);
  const filteredDialogs = dialogs.filter((dialog) => {
    const matchesSearch =
      !searchQuery ||
      dialog.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dialog.phone_number?.includes(searchQuery) ||
      dialog.last_message?.toLowerCase().includes(searchQuery.toLowerCase());
    const isInstagram =
      dialog.platform === "instagram" ||
      dialog.channel === "instagram" ||
      Boolean(dialog.instagram_id);
    const matchesPlatform =
      platformFilter === "all" ||
      (platformFilter === "instagram" && isInstagram) ||
      (platformFilter === "telegram" && !isInstagram);
    return matchesSearch && matchesPlatform;
  });
  const selectedPlatformIsInstagram =
    selectedDialog?.platform === "instagram" ||
    selectedDialog?.channel === "instagram" ||
    Boolean(selectedDialog?.instagram_id);

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[560px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Left pane: inbox menu */}
      <aside className={`shrink-0 border-r border-slate-200 bg-white ${showMessages ? "hidden md:flex md:w-[280px]" : "flex w-full md:w-[280px]"}`}>
        <div className="flex h-full w-full flex-col">
          <div className="border-b border-slate-200 px-4 py-3.5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950">Xabarlar</h2>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                {dialogs.length}
              </span>
            </div>
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Qidirish..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div className="mt-2.5 flex gap-1 rounded-lg bg-slate-100 p-1">
              {([
                ["all", "Hammasi"],
                ["telegram", "Telegram"],
                ["instagram", "Instagram"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPlatformFilter(value)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold ${
                    platformFilter === value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
        </div>
          <div className="flex-1 overflow-y-auto">
          {loadingDialogs ? (
            <div className="p-8 text-center text-slate-400">
              <div className="animate-spin h-6 w-6 border-3 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
              Yuklanmoqda...
            </div>
          ) : filteredDialogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Yozishmalar topilmadi</div>
          ) : (
            filteredDialogs.map((d) => (
              <div
                key={d.user_id}
                onClick={() => handleSelectUser(d.user_id)}
                className={`cursor-pointer border-b border-slate-100 px-3.5 py-3 transition-colors ${
                  selectedUserId === d.user_id
                    ? "bg-indigo-50"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    d.platform === "instagram" || d.channel === "instagram" || d.instagram_id
                      ? "bg-pink-100 text-pink-700"
                      : "bg-sky-100 text-sky-700"
                  }`}>
                    {d.full_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-start justify-between gap-2">
                      <h3 className="truncate text-[13px] font-semibold text-slate-900">{d.full_name}</h3>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {d.last_time ? format(new Date(d.last_time), "HH:mm") : ""}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {d.last_sender === "user" ? "" : d.last_sender === "bot" ? "Bot: " : "Siz: "}
                      {d.last_message}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                    {d.platform === "instagram" || d.channel === "instagram" || d.instagram_id ? (
                        <span className="rounded bg-pink-50 px-1.5 py-0.5 text-[9px] font-semibold text-pink-700">Instagram</span>
                    ) : (
                        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700">Telegram</span>
                    )}
                      {d.total_messages > 0 && (
                        <span className="text-[10px] text-slate-400">{d.total_messages} xabar</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          </div>
        </div>
      </aside>

      {/* Center pane: messages */}
      <section className={`min-w-0 flex-1 flex-col bg-slate-50 ${!showMessages ? "hidden md:flex" : "flex"}`}>
        {selectedUserId ? (
          <>
            <header className="flex h-[73px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-5">
              <button
                onClick={() => setShowMessages(false)}
                className="-ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden"
                aria-label="Suhbatlar ro'yxatiga qaytish"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                selectedPlatformIsInstagram ? "bg-pink-100 text-pink-700" : "bg-sky-100 text-sky-700"
              }`}>
                {selectedDialog?.full_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-slate-950">{selectedDialog?.full_name}</h3>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {selectedPlatformIsInstagram
                    ? `@${selectedDialog?.instagram_username || "Instagram"}`
                    : `Telegram • ${selectedDialog?.telegram_id}`}
                </p>
              </div>
              <span className={`hidden rounded-full px-2 py-1 text-[10px] font-semibold sm:inline ${
                selectedPlatformIsInstagram
                  ? "bg-pink-50 text-pink-700"
                  : "bg-sky-50 text-sky-700"
              }`}>
                {selectedPlatformIsInstagram ? "Instagram Direct" : "Telegram Bot"}
              </span>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-5 md:px-7">
              {loadingMessages ? (
                <div className="mt-10 text-center text-sm text-slate-400">
                  <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  Xabarlar yuklanmoqda...
                </div>
              ) : messages.length === 0 ? (
                <div className="mt-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8.5 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-3.5 3v-3Z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">Bu suhbat hali bo‘sh</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => {
                    const isLawyer = m.sender_type === "lawyer";
                    const isBot = m.sender_type === "bot";
                    return (
                      <div key={m.id} className={`flex ${isLawyer ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                            isLawyer
                              ? "rounded-br-md bg-indigo-600 text-white"
                              : isBot
                                ? "rounded-bl-md border border-blue-100 bg-blue-50 text-slate-800"
                                : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <div className={`mb-1 text-[9px] font-semibold ${isLawyer ? "text-indigo-100" : "text-slate-400"}`}>
                            {isLawyer ? "Huquqshunos" : isBot ? "Bot / AI" : "Mijoz"}
                          </div>
                          <div className="whitespace-pre-wrap text-[13px] leading-[1.55]">{m.text}</div>
                          <div className={`mt-1 text-right text-[9px] ${isLawyer ? "text-indigo-100" : "text-slate-400"}`}>
                            {m.created_at ? format(new Date(m.created_at), "HH:mm") : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 md:px-5">
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Mijozga xabar yozing..."
                  rows={1}
                  className="max-h-28 min-h-10 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm placeholder:text-slate-400"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? "Yuborilmoqda..." : "Yuborish"}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-slate-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8.5 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-3.5 3v-3Z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">Yozishmani ko‘rish uchun mijozni tanlang</p>
          </div>
        )}
      </section>

      {/* Right pane: customer information */}
      <aside className="hidden w-[280px] shrink-0 border-l border-slate-200 bg-white xl:block">
        {selectedDialog ? (
          <div className="h-full overflow-y-auto">
            <div className="border-b border-slate-200 px-5 py-5 text-center">
              <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold ${
                selectedPlatformIsInstagram ? "bg-pink-100 text-pink-700" : "bg-sky-100 text-sky-700"
              }`}>
                {selectedDialog.full_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <h3 className="mt-3 truncate text-sm font-semibold text-slate-950">{selectedDialog.full_name}</h3>
              <p className="mt-1 text-[11px] text-slate-500">
                {selectedPlatformIsInstagram ? "Instagram Direct" : "Telegram Bot"}
              </p>
            </div>

            <div className="border-b border-slate-200 px-5 py-4">
              <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Mijoz ma’lumotlari</h4>
              <div className="space-y-3 text-xs">
                <label className="block">
                  <span className="mb-1 block text-slate-400">Ism</span>
                  <input
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 font-medium text-slate-800"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-slate-400">Telefon raqami</span>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(event) => setProfilePhone(event.target.value)}
                    placeholder="+998 ..."
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 font-medium text-slate-800"
                  />
                </label>
                <div>
                  <span className="mb-1 block text-slate-400">
                    {selectedPlatformIsInstagram ? "Telegram / Instagram ID" : "Telegram ID"}
                  </span>
                  <div className="flex h-9 items-center rounded-lg border border-slate-100 bg-slate-50 px-3 font-mono text-[11px] text-slate-500">
                    {selectedPlatformIsInstagram
                      ? selectedDialog.instagram_id || "-"
                      : selectedDialog.telegram_id}
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-slate-400">Holati</span>
                  <select
                    value={profileStatus}
                    onChange={(event) => setProfileStatus(event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-medium text-slate-800"
                  >
                    {LEAD_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="h-9 w-full rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingProfile ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  To‘lovlar
                </h4>
                {!loadingTransactions && selectedTransactions.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {selectedTransactions.length}
                  </span>
                )}
              </div>
              {loadingTransactions ? (
                <p className="text-xs text-slate-400">To‘lovlar yuklanmoqda...</p>
              ) : selectedTransactions.length === 0 ? (
                <p className="text-xs leading-relaxed text-slate-400">
                  Bu mijozda to‘lovlar mavjud emas.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {selectedTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {formatCurrency(transaction.amount)}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${getStatusColor(
                            transaction.payment_status
                          )}`}
                        >
                          {PAYMENT_STATUS_LABELS[transaction.payment_status] ||
                            transaction.payment_status}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs font-medium text-slate-700">
                        {transaction.service_title || "Yuridik xizmat / Konsultatsiya"}
                      </p>
                      <div className="mt-2 space-y-1 text-[10px] text-slate-500">
                        <div className="flex justify-between gap-2">
                          <span>Usul</span>
                          <span className="text-right font-medium text-slate-700">
                            {PAYMENT_METHOD_LABELS[transaction.payment_method] ||
                              transaction.payment_method}
                          </span>
                        </div>
                        {transaction.payment_method === "p2p_card" && (
                          <>
                            <div className="flex justify-between gap-2">
                              <span>Chek</span>
                              <span
                                className={`text-right font-semibold ${
                                  receiptSubmitted ? "text-emerald-600" : "text-amber-600"
                                }`}
                              >
                                {receiptSubmitted ? "Yuborilgan" : "Kutilmoqda"}
                              </span>
                            </div>
                            {latestReceiptMessage && receiptUrls[latestReceiptMessage.id] && (
                              <a
                                href={receiptUrls[latestReceiptMessage.id]}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 block overflow-hidden rounded-md border border-slate-200 bg-white"
                              >
                                <img
                                  src={receiptUrls[latestReceiptMessage.id]}
                                  alt="To‘lov cheki"
                                  className="max-h-36 w-full object-contain"
                                />
                                <span className="block border-t border-slate-100 px-2 py-1 text-center text-[10px] font-semibold text-indigo-600">
                                  Chekni kattalashtirish
                                </span>
                              </a>
                            )}
                          </>
                        )}
                        <div className="flex justify-between gap-2">
                          <span>Sana</span>
                          <span className="text-right font-medium text-slate-700">
                            {formatDate(transaction.created_at)}
                          </span>
                        </div>
                        {transaction.transaction_ref && (
                          <div className="flex justify-between gap-2">
                            <span>Tranzaksiya</span>
                            <span className="max-w-[145px] truncate text-right font-mono text-slate-700">
                              {transaction.transaction_ref}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-4">
              <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Suhbat haqida</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Jami xabarlar</span>
                  <span className="font-semibold text-slate-800">{selectedDialog.total_messages}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Oxirgi faollik</span>
                  <span className="font-semibold text-slate-800">
                    {selectedDialog.last_time ? format(new Date(selectedDialog.last_time), "dd.MM HH:mm") : "-"}
                  </span>
                </div>
                {(selectedDialog.detected_category || selectedDialog.risk_level) && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500">Murojaat turi</span>
                    <span className="text-right font-semibold text-slate-800">
                      {selectedDialog.detected_category || "-"}
                      {selectedDialog.risk_level ? ` · ${selectedDialog.risk_level}` : ""}
                    </span>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Murojaat mazmuni
                  </span>
                  <p className="text-xs leading-relaxed text-slate-700">
                    {selectedDialog.inquiry_summary ||
                      "Mijoz hali murojaat mazmunini qoldirmagan."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-slate-400">
            Mijozni tanlagandan so‘ng ma’lumotlar bu yerda ko‘rinadi
          </div>
        )}
      </aside>
    </div>
  );
}
