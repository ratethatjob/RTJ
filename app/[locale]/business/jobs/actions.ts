"use server";

import { updateTag } from "next/cache";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { getUser } from "@/lib/auth";
import { summarizeApplication } from "@/lib/candidate-ai";
import { sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";
import { JOB_TIERS, type JobTier } from "@/lib/site-config";
import { type JobPayment, payForJob } from "@/app/[locale]/business/billing/actions";
import type { ApplyMode, JobQuestion } from "@/lib/data/types";
import { parseQuestions } from "@/lib/job-questions";
import { isLanguageCode, type JobLanguage, parseLanguages } from "@/lib/languages";

export type JobInput = {
  locationId: string;
  title: string;
  workType: string;
  schedule: string;
  payMin: string;
  payMax: string;
  payCurrency: string;
  payPeriod: string;
  description: string;
  responsibilities: string;
  requirements: string;
  offers: string;
  applyMode: ApplyMode;
  adLanguage: string;
  languages: JobLanguage[];
  questions: JobQuestion[];
  tier: JobTier;
  closesAt: string;
};

type Result = { ok?: true; id?: string; error?: "invalid" | "generic"; payment?: JobPayment };

const WORK = ["permanent", "temporary"];
const SCHEDULE = ["full_time", "part_time", "shifts", "flexible"];
const PERIOD = ["hour", "day", "week", "month", "year"];

function parse(input: JobInput) {
  const num = (v: string) => {
    const s = v.replace(/\s/g, "").replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 && n < 1e10 ? n : NaN;
  };
  const payMin = num(input.payMin);
  const payMax = num(input.payMax);
  const title = input.title.trim();
  const description = input.description.trim();
  const questions = parseQuestions(input.questions);
  const languages = parseLanguages(input.languages);
  // One item per line.
  const lines = (v: string) =>
    v
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
  const lists = [lines(input.responsibilities), lines(input.requirements), lines(input.offers)];
  const hasPay = payMin != null || payMax != null;
  if (
    title.length < 2 ||
    title.length > 120 ||
    !description ||
    description.length > 8000 ||
    !questions ||
    !languages ||
    (input.adLanguage !== "" && !isLanguageCode(input.adLanguage)) ||
    !["quick", "cv"].includes(input.applyMode) ||
    !JOB_TIERS.includes(input.tier) ||
    lists.some((l) => l.length > 15 || l.some((item) => item.length > 300)) ||
    !WORK.includes(input.workType) ||
    !SCHEDULE.includes(input.schedule) ||
    Number.isNaN(payMin) ||
    Number.isNaN(payMax) ||
    (payMin != null && payMax != null && payMax < payMin) ||
    (hasPay && (!/^[A-Z]{3}$/.test(input.payCurrency) || !PERIOD.includes(input.payPeriod))) ||
    (input.closesAt && !/^\d{4}-\d{2}-\d{2}$/.test(input.closesAt))
  ) {
    return null;
  }
  return {
    title,
    work_type: input.workType,
    schedule: input.schedule,
    pay_min: payMin,
    pay_max: payMax,
    pay_currency: hasPay ? input.payCurrency : null,
    pay_period: hasPay ? input.payPeriod : null,
    description,
    responsibilities: lists[0],
    requirements: lists[1],
    offers: lists[2],
    apply_mode: input.applyMode,
    ad_language: input.adLanguage || null,
    languages,
    questions,
    question: null,
    tier: input.tier,
    closes_at: input.closesAt || null,
  };
}

function refresh(id: string, locationId: string) {
  updateTag("jobs");
  updateTag(`job:${id}`);
  updateTag(`jobs:${locationId}`);
}

// A job goes live only once its package is paid (Stripe Checkout, or an invoice marked paid by
// an admin): saving keeps it a draft, and publishing returns the payment to make.
export async function createJob(orgId: string, input: JobInput, publish: boolean): Promise<Result> {
  const row = parse(input);
  if (!row) return { error: "invalid" };
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const { data, error } = await supabase
    .from("jobs")
    .insert({ ...row, location_id: input.locationId, org_id: orgId, created_by: user.id, status: "draft" })
    .select("id")
    .single();
  if (error) return { error: "generic" };
  refresh(data.id, input.locationId);
  return { ok: true, id: data.id, ...(publish && { payment: await payForJob(data.id, input.tier) }) };
}

export async function updateJob(id: string, input: JobInput, publish: boolean): Promise<Result> {
  const row = parse(input);
  if (!row) return { error: "invalid" };
  const { supabase } = await getUser();
  const { data: current } = await supabase.from("jobs").select("tier, published_at").eq("id", id).maybeSingle();
  if (!current) return { error: "generic" };
  // A live job keeps its package until the upgrade is paid.
  const live = Boolean(current.published_at);
  const upgrade = live && JOB_TIERS.indexOf(input.tier) > JOB_TIERS.indexOf(current.tier as JobTier);
  const { data, error } = await supabase
    .from("jobs")
    .update({ ...row, ...(live && { tier: current.tier }) })
    .eq("id", id)
    .select("id, location_id");
  if (error || !data.length) return { error: "generic" };
  refresh(id, data[0].location_id);
  const pay = upgrade || (!live && publish);
  return { ok: true, id, ...(pay && { payment: await payForJob(id, input.tier) }) };
}

export async function setJobStatus(id: string, status: "open" | "closed"): Promise<Result> {
  const { supabase } = await getUser();
  const { data, error } = await supabase.from("jobs").update({ status }).eq("id", id).select("location_id");
  if (error || !data.length) return { error: "generic" };
  refresh(id, data[0].location_id);
  return { ok: true };
}

export async function decideApplication(
  id: string,
  status: "interviewing" | "rejected" | "hired",
): Promise<Result> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("set_application_status", { p_application_id: id, p_status: status });
  if (error) return { error: "generic" };
  updateTag("locations");
  return { ok: true };
}

type Listed = { id: string; email: string | null; full_name: string };

/** The application, if the signed-in user manages its job (checked by the RPC). */
async function managed(jobId: string, applicationId: string) {
  const { supabase } = await getUser();
  const { data } = await supabase.rpc("job_application_list", { p_job_id: jobId });
  const app = ((data ?? []) as Listed[]).find((a) => a.id === applicationId);
  return app ? { supabase, app } : null;
}

/** Message to the applicant: in their account, and by email when they gave one. */
export async function messageApplicant(jobId: string, applicationId: string, body: string): Promise<Result> {
  const text = body.trim();
  if (!text || text.length > 4000) return { error: "invalid" };
  const found = await managed(jobId, applicationId);
  if (!found) return { error: "generic" };
  const { supabase, app } = found;
  const { error } = await supabase.rpc("send_application_message", {
    p_application_id: applicationId,
    p_body: text,
    p_language: await getLocale(),
  });
  if (error) return { error: "generic" };
  updateTag("locations");
  if (app.email) {
    const { data: job } = await supabase
      .from("jobs")
      .select("title, locations(name, country)")
      .eq("id", jobId)
      .single();
    const place = job?.locations as unknown as { name: string; country: string } | null;
    const locale = place?.country === "HU" ? "hu" : "en";
    const t = await getTranslations({ locale, namespace: "Email" });
    const prefix = locale === "en" ? "" : `/${locale}`;
    after(() =>
      sendEmail(
        app.email!,
        t("messageSubject", { company: place?.name ?? "", job: job?.title ?? "" }),
        t("messageBody", {
          name: app.full_name,
          company: place?.name ?? "",
          job: job?.title ?? "",
          message: text,
          link: `${SITE_URL}${prefix}/app/applications/${applicationId}`,
        }),
      ),
    );
  }
  return { ok: true };
}

export async function logCall(applicationId: string): Promise<Result> {
  const { supabase } = await getUser();
  const { error } = await supabase.rpc("log_application_call", { p_application_id: applicationId });
  return error ? { error: "generic" } : { ok: true };
}

/** Writes or refreshes the AI summary (basic and pro packages). */
export async function refreshInsight(jobId: string, applicationId: string): Promise<Result> {
  const found = await managed(jobId, applicationId);
  if (!found) return { error: "generic" };
  const ok = await summarizeApplication(applicationId).catch(() => false);
  return ok ? { ok: true } : { error: "generic" };
}
