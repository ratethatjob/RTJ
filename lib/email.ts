// Transactional email through Resend's HTTP API. Skipped silently without RESEND_API_KEY.

/** `html` is optional; the plain `text` is always sent too. */
export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "RateThatJob <no-reply@ratethatjob.com>",
      to: [to],
      subject,
      text,
      ...(html && { html }),
    }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export type BatchEmail = { to: string; subject: string; text: string; headers?: Record<string, string> };

/** Up to 100 emails per Resend batch call. Returns how many of the given emails were accepted, in order. */
export async function sendEmailBatch(emails: BatchEmail[]): Promise<boolean[]> {
  const key = process.env.RESEND_API_KEY;
  const result = emails.map(() => false);
  if (!key) return result;
  const from = process.env.EMAIL_FROM ?? "RateThatJob <no-reply@ratethatjob.com>";
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(chunk.map((e) => ({ from, to: [e.to], subject: e.subject, text: e.text, headers: e.headers }))),
    }).catch(() => null);
    if (res?.ok) chunk.forEach((_, j) => (result[i + j] = true));
  }
  return result;
}
