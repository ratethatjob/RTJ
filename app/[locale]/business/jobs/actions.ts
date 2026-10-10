"use server";

import { revalidateTag } from "next/cache";
import { getUser } from "@/lib/auth";

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
  question: string;
  closesAt: string;
};

type Result = { ok?: true; id?: string; error?: "invalid" | "generic" };

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
  const question = input.question.trim();
  const hasPay = payMin != null || payMax != null;
  if (
    title.length < 2 ||
    title.length > 120 ||
    !description ||
    description.length > 8000 ||
    question.length > 300 ||
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
    question: question || null,
    closes_at: input.closesAt || null,
  };
}

function refresh(id: string, locationId: string) {
  revalidateTag("jobs", "max");
  revalidateTag(`job:${id}`, "max");
  revalidateTag(`jobs:${locationId}`, "max");
}

export async function createJob(orgId: string, input: JobInput, publish: boolean): Promise<Result> {
  const row = parse(input);
  if (!row) return { error: "invalid" };
  const { supabase, user } = await getUser();
  if (!user) return { error: "generic" };
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      ...row,
      location_id: input.locationId,
      org_id: orgId,
      created_by: user.id,
      status: publish ? "open" : "draft",
    })
    .select("id")
    .single();
  if (error) return { error: "generic" };
  refresh(data.id, input.locationId);
  return { ok: true, id: data.id };
}

export async function updateJob(id: string, input: JobInput, publish: boolean): Promise<Result> {
  const row = parse(input);
  if (!row) return { error: "invalid" };
  const { supabase } = await getUser();
  const { data, error } = await supabase
    .from("jobs")
    .update({ ...row, ...(publish && { status: "open" }) })
    .eq("id", id)
    .select("id, location_id");
  if (error || !data.length) return { error: "generic" };
  refresh(id, data[0].location_id);
  return { ok: true, id };
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
  revalidateTag("locations", "max");
  return { ok: true };
}
