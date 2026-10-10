"use server";

import { getUser } from "@/lib/auth";
import type { JobQuestion } from "@/lib/data/types";
import { parseAnswers } from "@/lib/job-questions";

export type ApplyInput = {
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  startWhen: string;
  experience: boolean | null;
  answers: Record<string, boolean | string>;
  cvPath: string | null;
  message: string;
};

const START = ["now", "two_weeks", "later"];

export async function applyToJob(
  input: ApplyInput,
): Promise<{ ok?: true; error?: "required" | "cv" | "closed" | "exists" | "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };

  // Mode and questions come from the job itself, not from the browser.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, apply_mode, questions, status")
    .eq("id", input.jobId)
    .maybeSingle();
  if (!job || job.status !== "open") return { error: "closed" };
  const quick = job.apply_mode === "quick";

  const fullName = input.fullName.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  const message = input.message.trim();
  const answers = parseAnswers(job.questions as JobQuestion[], input.answers);
  if (
    fullName.length < 2 ||
    fullName.length > 120 ||
    (!email && !phone) ||
    (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) ||
    (phone && (phone.length < 6 || phone.length > 40)) ||
    message.length > 2000 ||
    !answers ||
    (quick && (!START.includes(input.startWhen) || input.experience == null))
  ) {
    return { error: "required" };
  }
  const cvPath = input.cvPath ?? "";
  if (!quick && !cvPath.startsWith(`${job.id}/${user.id}/`)) return { error: "cv" };

  const { error } = await supabase.from("job_applications").insert({
    job_id: job.id,
    user_id: user.id,
    full_name: fullName,
    email: email || null,
    phone: phone || null,
    start_when: START.includes(input.startWhen) ? input.startWhen : null,
    experience: input.experience,
    answers,
    cv_path: quick ? null : cvPath,
    message: message || null,
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
