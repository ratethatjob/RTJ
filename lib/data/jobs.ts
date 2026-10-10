import { cacheLife, cacheTag } from "next/cache";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { sampleJobs } from "./sample-jobs";
import { publicClient } from "./supabase";
import type { Category, Job, JobSchedule, PayPeriod, WorkType } from "./types";

// Open jobs from the public_jobs view (sample data without Supabase).
const useSupabase = Boolean(supabaseUrl && supabaseKey);

type JobRow = {
  id: string;
  title: string;
  work_type: WorkType;
  schedule: JobSchedule;
  pay_min: number | null;
  pay_max: number | null;
  pay_currency: string | null;
  pay_period: PayPeriod | null;
  description: string;
  question: string | null;
  published_at: string;
  closes_at: string | null;
  updated_at: string;
  location_id: string;
  location_slug: string;
  location_name: string;
  address: string;
  city: string;
  city_slug: string;
  country: string;
  category: Category;
  company_slug: string;
  company_name: string;
};

function toJob(r: JobRow): Job {
  return {
    id: r.id,
    title: r.title,
    workType: r.work_type,
    schedule: r.schedule,
    payMin: r.pay_min == null ? null : Number(r.pay_min),
    payMax: r.pay_max == null ? null : Number(r.pay_max),
    payCurrency: r.pay_currency,
    payPeriod: r.pay_period,
    description: r.description,
    question: r.question,
    publishedAt: r.published_at,
    closesAt: r.closes_at,
    updatedAt: r.updated_at,
    location: {
      id: r.location_id,
      slug: r.location_slug,
      name: r.location_name,
      address: r.address,
      city: r.city,
      citySlug: r.city_slug,
      country: r.country,
      category: r.category,
      companySlug: r.company_slug,
      companyName: r.company_name,
    },
  };
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function getLocationJobs(locationId: string): Promise<Job[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs", `jobs:${locationId}`);
  if (!useSupabase) return sampleJobs.filter((j) => j.location.id === locationId);
  const { data, error } = await publicClient()
    .from("public_jobs")
    .select("*")
    .eq("location_id", locationId)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return data.map(toJob);
}

export async function getJob(id: string): Promise<Job | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs", `job:${id}`);
  if (!useSupabase) return sampleJobs.find((j) => j.id === id) ?? null;
  if (!isUuid(id)) return null;
  const { data, error } = await publicClient().from("public_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data && toJob(data);
}

/** /jobs listing: title/company and where (city or street). */
export async function findJobs(q: string, where: string, category: Category | null): Promise<Job[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("jobs");
  const term = q.trim().toLowerCase();
  const place = where.trim().toLowerCase();
  if (!useSupabase) {
    return sampleJobs.filter(
      (j) =>
        (!term || `${j.title} ${j.location.companyName}`.toLowerCase().includes(term)) &&
        (!place || `${j.location.address} ${j.location.city}`.toLowerCase().includes(place)) &&
        (!category || j.location.category === category),
    );
  }
  const safe = (s: string) => s.replace(/[%_\\,()]/g, " ");
  let query = publicClient().from("public_jobs").select("*");
  if (term) query = query.or(`title.ilike.%${safe(term)}%,company_name.ilike.%${safe(term)}%`);
  if (place) query = query.or(`city.ilike.%${safe(place)}%,address.ilike.%${safe(place)}%`);
  if (category) query = query.eq("category", category);
  const { data, error } = await query.order("published_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data.map(toJob);
}

/** Every open job, for generateStaticParams and the sitemap. */
export async function getAllJobs(): Promise<Job[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs");
  if (!useSupabase) return sampleJobs;
  const { data, error } = await publicClient()
    .from("public_jobs")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return data.map(toJob);
}
