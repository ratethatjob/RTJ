"use server";

import { after } from "next/server";
import { getUser } from "@/lib/auth";
import { followupQuestions, summarizeApplication } from "@/lib/candidate-ai";
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
  source: "site" | "embed";
};

const START = ["now", "two_weeks", "later"];

export async function applyToJob(
  input: ApplyInput,
): Promise<{ ok?: true; id?: string; followups?: boolean; error?: "required" | "cv" | "closed" | "exists" | "generic" }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };

  // Mode and questions come from the job itself, not from the browser.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, apply_mode, questions, status, tier")
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

  const { data: created, error } = await supabase.from("job_applications").insert({
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
    source: input.source === "embed" ? "embed" : "site",
  }).select("id").single();
  if (!error) {
    // Pro jobs ask follow-up questions first; the summary is written after they're answered or skipped.
    if (job.tier === "basic") after(() => summarizeApplication(created.id));
    return { ok: true, id: created.id, followups: job.tier === "pro" };
  }
  if (error.code === "23505") return { error: "exists" };
  if (error.code === "42501") return { error: "closed" };
  return { error: "generic" };
}

export async function withdrawApplication(id: string): Promise<{ ok?: true; error?: true }> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("withdraw_application", { p_application_id: id });
  return error ? { error: true } : { ok: true };
}

/** Pro jobs: the AI's follow-up questions for a fresh application (created on first call). */
export async function getFollowups(applicationId: string, locale: string): Promise<{ id: string; question: string }[]> {
  const { supabase, user } = await getUser();
  if (!user) return [];
  // RLS: only the applicant's own application is visible here.
  const { data } = await supabase.from("job_applications").select("id").eq("id", applicationId).maybeSingle();
  if (!data) return [];
  const questions = await followupQuestions(applicationId, locale).catch(() => []);
  if (!questions.length) after(() => summarizeApplication(applicationId));
  return questions;
}

/** Saves follow-up answers (empty = skipped) and refreshes the employer's summary. */
export async function answerFollowups(applicationId: string, answers: Record<string, string>): Promise<{ ok?: true; error?: true }> {
  const { supabase } = await getUser();
  const clean = Object.fromEntries(
    Object.entries(answers)
      .filter(([k, v]) => /^[0-9a-f-]{36}$/i.test(k) && typeof v === "string" && v.trim())
      .map(([k, v]) => [k, v.trim().slice(0, 1000)]),
  );
  const { error } = await supabase.rpc("answer_followups", { p_application_id: applicationId, p_answers: clean });
  if (error) return { error: true };
  after(() => summarizeApplication(applicationId));
  return { ok: true };
}

/** The applicant's reply in the message thread with the employer. */
export async function replyToEmployer(applicationId: string, body: string): Promise<{ ok?: true; error?: true }> {
  const { supabase, user } = await getUser();
  const text = body.trim();
  if (!user || !text || text.length > 4000) return { error: true };
  const { error } = await supabase
    .from("application_messages")
    .insert({ application_id: applicationId, sender: "applicant", author_id: user.id, body: text });
  return error ? { error: true } : { ok: true };
}
