import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobForm } from "@/components/business/job-form";
import { getBusiness, pickLocation } from "@/lib/business";
import { currencyFor } from "@/lib/currency";

export const instant = false;

export default async function NewJobPage({ params, searchParams }: PageProps<"/[locale]/business/jobs/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const { org } = await getBusiness(locale, "/business/jobs/new");
  if (!org || org.locations.length === 0) return null;
  const t = await getTranslations("BusinessJobs");
  const location = pickLocation(org.locations, query.location) ?? org.locations[0];

  return (
    <main className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-4xl font-black tracking-brand lg:text-5xl">{t("newJob")}</h1>
      <JobForm
        orgId={org.id}
        locations={org.locations.map((l) => ({ id: l.id, name: l.name, address: l.address, country: l.country }))}
        initial={{
          locationId: location.id,
          title: "",
          workType: "permanent",
          schedule: "full_time",
          payMin: "",
          payMax: "",
          payCurrency: currencyFor(location.country),
          payPeriod: location.country === "HU" ? "month" : "hour",
          description: "",
          responsibilities: "",
          requirements: "",
          offers: "",
          applyMode: "quick",
          questions: [],
          tier: "standard",
          closesAt: "",
        }}
      />
    </main>
  );
}
