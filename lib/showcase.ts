// The sample workplace page (/sample-workplace): a made-up bakery that shows everything a workplace
// page with Pro can show. It lives in code, not in the database, so it never appears in search,
// city hubs, lists, sitemaps or statistics, and no data cleanup (demo purge, reset) touches it.

import type { Job, LocationScores, LocationSummary, Review } from "./data/types";

export const SHOWCASE_PATH = "/sample-workplace";
export const SHOWCASE_ID = "00000000-0000-4000-8000-00000000c0de";

type Rated = Review & { ratings: { manager: number; pay: number; schedule: number; environment: number } };

const text = (hu: string, en: string) => ({ original: hu, language: "hu", translations: { en } });

const review = (
  n: number,
  r: Omit<Rated, "id" | "workType" | "gotReply" | "replyDays" | "reply" | "body"> & {
    workType?: Rated["workType"];
    gotReply?: boolean | null;
    replyDays?: number | null;
    body: [string, string] | null;
    reply?: [string, string];
  },
): Rated => ({
  ...r,
  id: `${SHOWCASE_ID.slice(0, -2)}${String(n).padStart(2, "0")}`,
  workType: r.workType ?? "permanent",
  gotReply: r.gotReply ?? null,
  replyDays: r.replyDays ?? null,
  body: r.body ? text(...r.body) : null,
  reply: r.reply ? { body: text(...r.reply) } : null,
});

const yes = { paid_on_time: true, paid_as_promised: true, overtime_paid: true, hours_as_promised: true, would_return: true };

const REVIEWS: Rated[] = [
  review(1, {
    displayName: "Csendes Tölgy 42", position: "Pék", relationship: "current", periodStart: "2023-03-01", periodEnd: null,
    overall: 5, verification: "invited", facts: yes, publishedAt: "2026-09-28T09:00:00Z", helpfulCount: 7,
    ratings: { manager: 5, pay: 4, schedule: 4, environment: 5 },
    body: ["A hajnali kezdés nem mindenkinek való, de a csapat összetartó, a műszakvezető mindig ott van, ha gond van. A fizetés minden hónap 5-én megjön, a túlórát is kifizetik.", "The early start isn't for everyone, but the team sticks together and the shift lead is always there when something goes wrong. Pay arrives on the 5th every month and overtime is paid too."],
    reply: ["Köszönjük! A hajnali műszakra jövőre is két ember mellé egy harmadikat keresünk, hogy könnyebb legyen.", "Thank you! We're adding a third person next to the two on the early shift next year, to make it easier."],
  }),
  review(2, {
    displayName: "Fürge Mókus 7", position: "Barista", relationship: "current", periodStart: "2024-09-01", periodEnd: null,
    overall: 4, verification: "document", facts: { ...yes, overtime_paid: false }, publishedAt: "2026-09-14T09:00:00Z", helpfulCount: 4,
    ratings: { manager: 4, pay: 4, schedule: 3, environment: 5 },
    body: ["Jó hangulat, rendes vendégek. A beosztás néha csak csütörtökön jön ki a következő hétre, ezt lehetne korábban.", "Good atmosphere, nice customers. The rota sometimes only comes out on Thursday for the next week – that could be earlier."],
    reply: ["Igazad van. Októbertől a beosztás minden hétfőn kikerül a következő két hétre.", "You're right. From October the rota goes up every Monday for the next two weeks."],
  }),
  review(3, {
    displayName: "Napos Fenyő 15", position: "Eladó", workType: "temporary", relationship: "former", periodStart: "2025-06-01", periodEnd: "2025-09-01",
    overall: 4, verification: "invited", facts: yes, publishedAt: "2026-08-30T09:00:00Z",
    ratings: { manager: 4, pay: 4, schedule: 5, environment: 4 },
    body: ["Nyári munkának tökéletes volt, rugalmasan kaptam a műszakokat a vizsgáim mellé.", "Perfect as a summer job – I got flexible shifts around my exams."],
  }),
  review(4, {
    displayName: "Bátor Hold 23", position: "Cukrász", relationship: "former", periodStart: "2022-01-01", periodEnd: "2025-12-01",
    overall: 3, verification: "document", facts: { ...yes, hours_as_promised: false, would_return: false }, publishedAt: "2026-08-12T09:00:00Z", helpfulCount: 9,
    ratings: { manager: 3, pay: 3, schedule: 2, environment: 4 },
    body: ["Szakmailag sokat tanultam. Ünnepek előtt viszont rendszeresen 10-11 órásak voltak a napok, ezt előre nem mondták.", "I learned a lot as a pastry chef. Before holidays, though, days were regularly 10–11 hours, which nobody told me beforehand."],
    reply: ["Köszönjük az őszinte visszajelzést. Az ünnepi időszakra azóta külön kisegítőket veszünk fel, és a beosztásban előre jelezzük a hosszabb napokat.", "Thanks for the honest feedback. Since then we hire extra help for the holiday season and mark the longer days in the rota in advance."],
  }),
  review(5, {
    displayName: "Vidám Fűz 8", position: "Kiszállító", relationship: "current", periodStart: "2025-02-01", periodEnd: null,
    overall: 4, verification: "none", facts: { ...yes, overtime_paid: false }, publishedAt: "2026-07-22T09:00:00Z",
    ratings: { manager: 4, pay: 4, schedule: 4, environment: 4 },
    body: ["Céges autó, tankolás a cég kártyájával. A reggeli kiszállítás pörgős, de délre végzek.", "Company car, fuel on the company card. The morning deliveries are busy, but I'm done by noon."],
  }),
  review(6, {
    displayName: "Halk Patak 31", position: "Pék", relationship: "applicant", periodStart: "2026-06-01", periodEnd: null,
    overall: 5, verification: "application", facts: {}, gotReply: true, replyDays: 2, publishedAt: "2026-07-05T09:00:00Z",
    ratings: { manager: 5, pay: 5, schedule: 5, environment: 5 },
    body: ["Két nap alatt visszahívtak, a próbanap is ki volt fizetve. Végül másik munkát választottam, de korrekt volt.", "They called me back within two days and the trial day was paid. I took another job in the end, but they were fair."],
  }),
  review(7, {
    displayName: "Kék Szirom 12", position: "Barista", workType: "temporary", relationship: "trial_shift", periodStart: "2026-05-01", periodEnd: "2026-05-01",
    overall: 4, verification: "invited", facts: { paid_on_time: true, paid_as_promised: true }, publishedAt: "2026-06-18T09:00:00Z",
    ratings: { manager: 4, pay: 4, schedule: 4, environment: 4 },
    body: ["A próbanapon rendesen betanítottak, nem csak a pult mögé állítottak.", "On the trial day they actually trained me instead of just putting me behind the counter."],
  }),
  review(8, {
    displayName: "Erős Szikla 5", position: "Pékségvezető-helyettes", relationship: "current", periodStart: "2021-04-01", periodEnd: null,
    overall: 5, verification: "document", facts: yes, publishedAt: "2026-05-30T09:00:00Z", helpfulCount: 3,
    ratings: { manager: 5, pay: 4, schedule: 4, environment: 5 },
    body: ["Öt éve vagyok itt. Amit megígérnek, azt betartják: emelés minden januárban, cafeteria, ingyen kenyér és kávé.", "I've been here five years. They keep their promises: a raise every January, cafeteria benefits, free bread and coffee."],
  }),
  review(9, {
    displayName: "Szelíd Felhő 19", position: "Eladó", relationship: "former", periodStart: "2024-01-01", periodEnd: "2025-03-01",
    overall: 3, verification: "none", facts: { ...yes, paid_on_time: false, would_return: false }, publishedAt: "2026-04-16T09:00:00Z",
    ratings: { manager: 2, pay: 4, schedule: 3, environment: 3 },
    body: ["A csapat jó volt, de az akkori boltvezetővel nem jöttünk ki, és kétszer is késett a fizetés pár napot. Azóta hallom, hogy változott a vezetés.", "The team was good, but I didn't get on with the shop manager at the time, and pay was a few days late twice. I hear management has changed since."],
    reply: ["Köszönjük, hogy megírtad. Tavasz óta új boltvezetőnk van, és havonta tartunk rövid csapatmegbeszélést.", "Thanks for writing. We've had a new shop manager since spring and hold a short team meeting every month."],
  }),
  review(10, {
    displayName: "Gyors Nyúl 27", position: "Pék", relationship: "applicant", periodStart: "2026-03-01", periodEnd: null,
    overall: 4, verification: "application", facts: {}, gotReply: true, replyDays: 4, publishedAt: "2026-03-28T09:00:00Z",
    ratings: { manager: 4, pay: 4, schedule: 4, environment: 4 },
    body: ["Négy nap után kaptam választ, sajnos nemet, de legalább megindokolták.", "I got an answer after four days – a no, unfortunately, but at least they explained why."],
  }),
  review(11, {
    displayName: "Tiszta Forrás 3", position: "Takarító", workType: "temporary", relationship: "current", periodStart: "2025-10-01", periodEnd: null,
    overall: 4, verification: "invited", facts: yes, publishedAt: "2026-02-20T09:00:00Z",
    ratings: { manager: 4, pay: 3, schedule: 5, environment: 4 },
    body: null,
  }),
  review(12, {
    displayName: "Zöld Lomb 44", position: "Barista", relationship: "former", periodStart: "2023-05-01", periodEnd: "2025-08-01",
    overall: 5, verification: "document", facts: yes, publishedAt: "2026-01-09T09:00:00Z", helpfulCount: 2,
    ratings: { manager: 5, pay: 4, schedule: 5, environment: 5 },
    body: ["Költözés miatt mentem el, szívesen visszamennék. A tanulóidőt is rendesen kifizették.", "I left because I moved, and I'd gladly go back. Even the training period was paid properly."],
    reply: ["Bármikor szívesen látunk újra! 🥐", "You're welcome back any time! 🥐"],
  }),
];

/** Scores as the database would compute them: verified reviews count 1.0, unverified 0.5;
 *  applicant reviews feed the reply rate, not the job facts. */
function scores(): LocationScores {
  const w = (r: Rated) => (r.verification === "none" ? 0.5 : 1);
  const avg = (pick: (r: Rated) => number) =>
    Math.round((REVIEWS.reduce((n, r) => n + pick(r) * w(r), 0) / REVIEWS.reduce((n, r) => n + w(r), 0)) * 10) / 10;
  const pct = (k: keyof typeof yes) => {
    const answered = REVIEWS.filter((r) => r.facts[k] != null);
    return answered.length ? Math.round((answered.filter((r) => r.facts[k]).length / answered.length) * 100) : null;
  };
  return {
    overall: avg((r) => r.overall),
    manager: avg((r) => r.ratings.manager),
    pay: avg((r) => r.ratings.pay),
    schedule: avg((r) => r.ratings.schedule),
    environment: avg((r) => r.ratings.environment),
    reviewCount: REVIEWS.length,
    verifiedCount: REVIEWS.filter((r) => r.verification !== "none").length,
    facts: {
      paid_on_time: pct("paid_on_time"),
      paid_as_promised: pct("paid_as_promised"),
      overtime_paid: pct("overtime_paid"),
      hours_as_promised: pct("hours_as_promised"),
    },
    replyRate: SHOWCASE_GHOSTING.replyRate,
    avgReplyDays: SHOWCASE_GHOSTING.avgReplyDays,
  };
}

/** Reply rate from applications on RateThatJob (shown once 5 are decided). */
export const SHOWCASE_GHOSTING = { replyRate: 94, avgReplyDays: 2, applications: 31 };

type Lang = "hu" | "en";

/** A made-up brand per language (real workplace names are never translated; this is only the sample). */
export const SHOWCASE_BRAND = {
  hu: { name: "Kávé & Kovász Pékség", address: "Minta utca 12.", entity: "Kávé & Kovász Minta Kft.", monogram: "K&K", sign: "KÁVÉ & KOVÁSZ" },
  en: { name: "Crust & Crema Bakery", address: "12 Sample Street", entity: "Crust & Crema Sample Ltd.", monogram: "C&C", sign: "CRUST & CREMA" },
};

// English generated names and job titles for the sample's reviewers.
const NAMES_EN: Record<string, string> = {
  "Csendes Tölgy 42": "Quiet Oak 42", "Fürge Mókus 7": "Swift Squirrel 7", "Napos Fenyő 15": "Sunny Pine 15",
  "Bátor Hold 23": "Brave Moon 23", "Vidám Fűz 8": "Merry Willow 8", "Halk Patak 31": "Soft Brook 31",
  "Kék Szirom 12": "Blue Petal 12", "Erős Szikla 5": "Steady Rock 5", "Szelíd Felhő 19": "Gentle Cloud 19",
  "Gyors Nyúl 27": "Quick Hare 27", "Tiszta Forrás 3": "Clear Spring 3", "Zöld Lomb 44": "Green Leaf 44",
};
const POSITIONS_EN: Record<string, string> = {
  Pék: "Baker", Barista: "Barista", Eladó: "Sales assistant", Cukrász: "Pastry chef", Kiszállító: "Delivery driver",
  "Pékségvezető-helyettes": "Assistant bakery manager", Takarító: "Cleaner",
};

/** The text in one language as its original (the sample is written in each language). */
const own = (t: Review["body"], lang: Lang) =>
  t && { original: lang === "hu" ? t.original : (t.translations.en ?? t.original), language: lang, translations: {} };

function reviewsIn(lang: Lang): Review[] {
  return REVIEWS.map((r) => {
    const copy: Partial<Rated> = {
      ...r,
      displayName: lang === "hu" ? r.displayName : (NAMES_EN[r.displayName] ?? r.displayName),
      position: lang === "hu" ? r.position : (POSITIONS_EN[r.position] ?? r.position),
      body: own(r.body, lang),
      reply: r.reply && { body: own(r.reply.body, lang)! },
    };
    delete copy.ratings;
    return copy as Review;
  });
}

function locationIn(lang: Lang): LocationSummary {
  const b = SHOWCASE_BRAND[lang];
  return {
    id: SHOWCASE_ID,
    companySlug: "sample-workplace",
    companyName: b.name,
    slug: "",
    name: b.name,
    address: b.address,
    city: "Budapest",
    citySlug: "budapest",
    country: "HU",
    category: "cafe",
    placeType: { type: "bakery", en: null, hu: null },
    legalEntityName: b.entity,
    claimed: true,
    scores: scores(),
    ghosting: SHOWCASE_GHOSTING,
    indexActive: true,
  };
}

/** "From the employer": text and perks per language (photos are illustrations in the page). */
const PROFILE = {
  hu: {
    about:
      "Kovászos kenyér, kézzel hajtogatott croissant és specialty kávé a ház földszintjén. 14-en dolgozunk két műszakban: a pékség hajnali 4-kor indul, a kávézó 7-től 19-ig van nyitva. Új kollégát mindig betanítunk, a próbanapot kifizetjük.",
    benefits: ["Cafeteria", "Ingyen kávé és pékáru", "Kifizetett próbanap", "Bérlettámogatás", "Évente emelés", "Két hét előre kész beosztás"],
  },
  en: {
    about:
      "Sourdough bread, hand-laminated croissants and specialty coffee on the ground floor. We're 14 people on two shifts: the bakery starts at 4 am, the café is open 7 am to 7 pm. New colleagues are always trained, and the trial day is paid.",
    benefits: ["Cafeteria benefits", "Free coffee and pastries", "Paid trial day", "Travel pass support", "A raise every year", "Rota two weeks ahead"],
  },
};

function jobsIn(lang: Lang): Job[] {
  const place = locationIn(lang);
  const job = (j: Partial<Job> & Pick<Job, "id" | "title" | "schedule" | "applyMode" | "featured">): Job => ({
    workType: "permanent",
    payMin: null,
    payMax: null,
    payCurrency: "HUF",
    payPeriod: "hour",
    description: "",
    question: null,
    questions: [],
    adLanguage: lang,
    languages: [],
    responsibilities: [],
    requirements: [],
    offers: [],
    publishedAt: "2026-09-20T09:00:00Z",
    closesAt: null,
    updatedAt: "2026-09-20T09:00:00Z",
    location: {
      id: SHOWCASE_ID,
      slug: "",
      name: place.name,
      address: place.address,
      city: place.city,
      citySlug: place.citySlug,
      country: "HU",
      category: "cafe",
      companySlug: "sample-workplace",
      companyName: place.companyName,
    },
    ...j,
  });
  // One Pro (featured) ad with quick apply, one standard CV ad.
  return lang === "hu"
    ? [
        job({ id: "s1", title: "Pék – hajnali műszak", schedule: "shifts", applyMode: "quick", featured: true, payMin: 2600, payMax: 3000 }),
        job({ id: "s2", title: "Barista (részmunkaidő)", schedule: "part_time", applyMode: "cv", featured: false, payMin: 2200, payMax: 2400 }),
      ]
    : [
        job({ id: "s1", title: "Baker – early shift", schedule: "shifts", applyMode: "quick", featured: true, payMin: 2600, payMax: 3000 }),
        job({ id: "s2", title: "Barista (part-time)", schedule: "part_time", applyMode: "cv", featured: false, payMin: 2200, payMax: 2400 }),
      ];
}

/** Everything the sample page shows, in the page language. */
export function getShowcase(locale: string) {
  const lang: Lang = locale === "hu" ? "hu" : "en";
  return {
    brand: SHOWCASE_BRAND[lang],
    location: locationIn(lang),
    reviews: reviewsIn(lang),
    jobs: jobsIn(lang),
    profile: PROFILE[lang],
  };
}
