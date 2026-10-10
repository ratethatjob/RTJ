// Transactional email through Resend's HTTP API. Skipped silently without RESEND_API_KEY.

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
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
    }),
  }).catch(() => null);
  return Boolean(res?.ok);
}
