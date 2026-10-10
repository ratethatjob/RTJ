"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type ThreadMessage = { id: string; sender: "employer" | "applicant"; body: string; created_at: string };

type Props = {
  messages: ThreadMessage[];
  /** Which side is reading: their own messages sit on the right. */
  viewer: "employer" | "applicant";
  otherName: string;
  send: (body: string) => Promise<{ ok?: true; error?: true }>;
  /** Show the composer only after a tap (employer list). */
  collapsed?: boolean;
  readOnly?: boolean;
};

export function MessageThread({ messages, viewer, otherName, send, collapsed = false, readOnly = false }: Props) {
  const t = useTranslations("Thread");
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(!collapsed);
  const [body, setBody] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {messages.length > 0 && (
        <ol className="flex flex-col gap-2">
          {messages.map((m) => {
            const mine = m.sender === viewer;
            return (
              <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <span
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 ${
                    mine ? "bg-ink text-paper" : "bg-paper"
                  }`}
                >
                  {m.body}
                </span>
                <span className="mt-1 text-xs text-slate">
                  {mine ? t("you") : otherName} · {format.dateTime(new Date(m.created_at), { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {readOnly ? null : open ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            setError(false);
            startTransition(async () => {
              const result = await send(body);
              if (result.error) return setError(true);
              setBody("");
              router.refresh();
            });
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={t(viewer === "employer" ? "placeholderEmployer" : "placeholderApplicant")}
            aria-label={t("message")}
            className="w-full rounded-2xl border border-mist/60 bg-white px-4 py-3 outline-none focus:border-ink"
          />
          {viewer === "employer" && <p className="text-sm text-slate">{t("employerHint")}</p>}
          {error && <p className="font-black">{t("error")}</p>}
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="self-start rounded-2xl bg-ink px-5 py-2.5 font-black text-paper disabled:opacity-50"
          >
            {pending ? t("sending") : t("send")}
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="self-start rounded-2xl border-2 border-ink px-4 py-2 font-black">
          {t("write")}
        </button>
      )}
    </div>
  );
}
