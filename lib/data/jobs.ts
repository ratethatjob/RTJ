import { cacheLife, cacheTag } from "next/cache";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { sampleJobs } from "./sample-jobs";
import { publicClient } from "./supabase";
import type { ApplyMode, Category, Job, JobQuestion, JobSchedule, PayPeriod, WorkType } from "./types";

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
  apply_mode?: ApplyMode | null;
  questions?: JobQuestion[] | null;
  responsibilities?: string[] | null;
  requirements?: string[] | null;
  offers?: string[] | null;
  featured?: boolean | null;
  is_demo?: boolean | null;
  ad_language?: string | null;
  languages?: Job["languages"] | null;
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
    applyMode: r.apply_mode ?? "quick",
    questions: r.questions ?? [],
    responsibilities: r.responsibilities ?? [],
    requirements: r.requirements ?? [],
    offers: r.offers ?? [],
    featured: r.featured ?? false,
    isDemo: r.is_demo ?? false,
    adLanguage: r.ad_language ?? null,
    languages: r.languages ?? [],
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

/** Open jobs at every location of a company (jobs widget). */
export async function getCompanyJobs(companySlug: string): Promise<Job[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("jobs", `company:${companySlug}`);
  if (!useSupabase) return sampleJobs.filter((j) => j.location.companySlug === companySlug);
  const { data, error } = await publicClient()
    .from("public_jobs")
    .select("*")
    .eq("company_slug", companySlug)
    .order("published_at", { ascending: false })
    .limit(100);
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

/**
 * /jobs listing: title/company and where (city or street), optionally quick apply only, and a
 * language (jobs whose ad is written in it or that ask for it).
 */
export async function findJobs(
  q: string,
  where: string,
  category: Category | null,
  quickOnly = false,
  language: string | null = null,
): Promise<Job[]> {
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
        (!category || j.location.category === category) &&
        (!quickOnly || j.applyMode === "quick") &&
        (!language || j.adLanguage === language || j.languages.some((l) => l.code === language)),
    );
  }
  const safe = (s: string) => s.replace(/[%_\\,()]/g, " ");
  let query = publicClient().from("public_jobs").select("*");
  if (term) query = query.or(`title.ilike.%${safe(term)}%,company_name.ilike.%${safe(term)}%`);
  if (place) query = query.or(`city.ilike.%${safe(place)}%,address.ilike.%${safe(place)}%`);
  if (category) query = query.eq("category", category);
  if (quickOnly) query = query.eq("apply_mode", "quick");
  if (language && /^[a-z]{2}$/.test(language)) {
    query = query.or(`ad_language.eq.${language},languages.cs.[{"code":"${language}"}]`);
  }
  const { data, error } = await query.order("published_at", { ascending: false }).limit(50);
  if (error) throw error;
  // Featured (pro) jobs first; the sort is stable, so newest first within each group.
  return data.map(toJob).sort((a, b) => Number(b.featured) - Number(a.featured));
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

/** Up to 3 open jobs in these cities / this country (featured first), or the newest anywhere. */
export async function findJobsIn(column: "city_slug" | "country" | null, values: string[]): Promise<Job[]> {
  if (!useSupabase) {
    return sampleJobs
      .filter((j) => !column || values.includes(column === "city_slug" ? j.location.citySlug : j.location.country))
      .slice(0, 3);
  }
  let query = publicClient().from("public_jobs").select("*");
  if (column) query = query.in(column, values);
  const { data, error } = await query.order("published_at", { ascending: false }).limit(12);
  if (error) throw error;
  return data
    .map(toJob)
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 3);
}
