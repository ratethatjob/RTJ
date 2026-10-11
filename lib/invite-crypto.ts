import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { secretKey } from "./supabase/admin";

// Invite email addresses: AES-256-GCM encrypted (cleared after the reminder) and an HMAC hash
// (kept, for "already invited" and unsubscribes). Keys come from INVITE_SECRET, or the Supabase
// secret key when that is not set. Changing it makes pending reminders and old hashes unusable.

function keys() {
  const material = process.env.INVITE_SECRET || secretKey;
  if (!material) return null;
  const derive = (info: string) => Buffer.from(hkdfSync("sha256", material, "rtj-invites", info, 32));
  return { enc: derive("encrypt"), hash: derive("hash") };
}

export const inviteCryptoReady = () => keys() !== null;

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/.test(email) ? email : null;
}

export function hashEmail(email: string): string {
  return createHmac("sha256", keys()!.hash).update(email).digest("hex");
}

export function encryptEmail(email: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys()!.enc, iv);
  const data = Buffer.concat([cipher.update(email, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64")}`;
}

export function decryptEmail(value: string): string | null {
  const k = keys();
  if (!k || !value.startsWith("v1:")) return null;
  try {
    const raw = Buffer.from(value.slice(3), "base64");
    const decipher = createDecipheriv("aes-256-gcm", k.enc, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
