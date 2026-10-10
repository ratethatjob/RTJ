"use server";

import { getUser } from "@/lib/auth";

export type ApplyInput = {
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  startWhen: string;
  experience: boolean | null;
  answer: string;
  message: string;
};

const START = ["now", "two_weeks", "later"];

export async function applyToJob(
  input: ApplyInput,
  hasQuestion: boolean,
): Promise<{ ok?: true; error?: "required" | "closed" | "exists" | "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const fullName = input.fullName.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  const answer = input.answer.trim();
  if (
    fullName.length < 2 ||
    fullName.length > 120 ||
    (!email && !phone) ||
    (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) ||
    (phone && (phone.length < 6 || phone.length > 40)) ||
    !START.includes(input.startWhen) ||
    input.experience == null ||
    (hasQuestion && !answer) ||
    answer.length > 1000 ||
    input.message.length > 2000
  ) {
    return { error: "required" };
  }
  const { error } = await supabase.from("job_applications").insert({
    job_id: input.jobId,
    user_id: user.id,
    full_name: fullName,
    email: email || null,
    phone: phone || null,
    start_when: input.startWhen,
    experience: input.experience,
    answer: answer || null,
    message: input.message.trim() || null,
  });
  if (!error) return { ok: true };
  if (error.code === "23505") return { error: "exists" };
  if (error.code === "42501") return { error: "closed" };
  return { error: "generic" };
}

export async function withdrawApplication(id: string): Promise<{ ok?: true; error?: true }> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("withdraw_application", { p_application_id: id });
  return error ? { error: true } : { ok: true };
}
