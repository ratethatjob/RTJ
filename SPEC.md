# RateThatJob.com – Product & Technical Spec (v0.1)

> Hand this file to Claude Code as the project brief. Put it in the repo root as `SPEC.md` and reference it from `CLAUDE.md`.
> Tagline: **Know before you go.**

---

## 1. What we are building

A workplace review platform focused on **location-level, frontline / hourly work** (restaurants, retail, warehouses, factories), also open to office jobs and startups.

Core promise to workers: verified reviews and hard facts (pay on time, overtime paid, promised hours, does the employer reply to applicants).
Core promise to employers: free access to your workplace profile, reply to reviews, invite your team, see early warnings per location.

Later phase: job posting + easy, CV-free applying on the same platform (the application flow also produces verified reviewers and the ghosting metric automatically).

### Principles
1. **SEO first.** Every company and location page must be server-rendered, fast and indexable. Most traffic will come from Google searches like "working at Joe's Pizzeria reviews".
2. **Mobile first.** Candidates use phones. Employer dashboard is desktop first but must work on mobile.
3. **Localization from day one.** UI in EN and HU at launch, more languages later. All user content (reviews, employer replies) is machine-translated with "Show original".
4. **Anonymity is non-negotiable.** Employers never learn who wrote a review or who responded to an invite.
5. **Every reviewer has an account**, but sign-up is one tap.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | SSR/ISR for public pages, React Server Components |
| Hosting | **Vercel** | Edge caching, ISR revalidation, OG image generation; functions in `fra1`, next to the database (Supabase eu-central-1) |
| Database | **Postgres (Supabase)** | Row Level Security on every table |
| Auth | **Supabase Auth** | Apple, Google, Facebook, email OTP (passwordless) |
| File storage | Supabase Storage, **private bucket** | Verification documents only; deleted 30 days after the decision |
| Styling | Tailwind CSS | Design tokens from section 12 |
| i18n | next-intl | Locale routing, ICU messages |
| Machine translation | LLM API (e.g. Claude) | Translate on publish, cache in DB |
| Moderation | LLM classifier + rules | Personal data, hate, threats; queue for manual review |
| Email | Resend (or Postmark) | Invites, reminders, notifications |
| Payments | Stripe Billing | Subscription per location (quantity-based), monthly / yearly |
| Places data | Google Places API; OpenStreetMap (Photon + Nominatim) until a Google key is set; OpenStreetMap Overpass for the bulk import | Location autocomplete, seeding, address normalization |
| Search | Postgres full-text + `pg_trgm` | Move to Typesense/Meilisearch when needed |
| Analytics | PostHog | Product analytics, funnels |
| Error tracking | Sentry | |
| Jobs / queues | Supabase Edge Functions + cron, or Inngest | Translation, delayed publishing, reminders, early warnings |

---

## 3. URL structure (SEO)

Public, server-rendered, human-readable slugs at the root:

```
ratethatjob.com/                                 Home / search
ratethatjob.com/{company-slug}                   Company page (all locations)
ratethatjob.com/{company-slug}/{location-slug}   Location page (the main SEO page)
ratethatjob.com/{company-slug}/{location-slug}/reviews?page=2
ratethatjob.com/search?q=&where=
ratethatjob.com/city/{city-slug}                 City hub (e.g. /city/budapest)
ratethatjob.com/city/{city-slug}/{category}      e.g. /city/budapest/restaurants
ratethatjob.com/employers                        Employer landing
ratethatjob.com/app/...                          Logged-in areas (noindex)
ratethatjob.com/business/...                     Employer dashboard (noindex)
```

Rules:
- Slugs: lowercase, ASCII transliteration (á → a, ő → o), hyphens, unique. Location slug from street/area: `w-46th-st`, `andrassy-ut-12`.
- **Reserved words list** (cannot be a company slug): `app`, `business`, `employers`, `search`, `city`, `api`, `login`, `signup`, `about`, `privacy`, `terms`, `help`, `blog`, `hu`, `en`, `de`, all locale codes, etc.
- Slug changes keep a **301 redirect** table (`slug_redirects`).
- Locales: default English at root, other languages under prefix: `/hu/{company-slug}/{location-slug}`. Every page outputs `hreflang` alternates and a canonical URL.

### Seeding from OpenStreetMap
- Workplaces without reviews come from OpenStreetMap (ODbL, attribution on the page and in the imprint), not from Google (its terms allow storing only the place id). Budapest and the 10 largest cities first: named, open places with a street address in our categories; chains are one company with many locations (brand / brand:wikidata); no private persons, no contact data. Refreshed monthly; places OSM no longer has are marked closed (hidden while unreviewed). Imported pages stay noindex and out of the sitemaps until the first published review.
- Google ↔ OSM matching: a picked Google place within 75 m of one of ours with a matching name or brand is the same workplace (the place id is added); unsure → "Did you mean …?". Search suggestions match ours by name + street and number. The admin merges remaining duplicates (reviews, followers, jobs, team rights move; the old URL redirects).
- Hand-entered workplaces: the typed address is geocoded from OpenStreetMap (Nominatim, Photon fallback; polite rate, User-Agent); not found → no coordinates, marked; never-tried ones retried daily. Admin list of new hand-entered workplaces (who/when, geocoded, possible duplicate) with OK / Edit / Merge / Hide (not public, not deleted), counted on the admin overview. After approval the employer can correct its location's name, address (geocoded again) and category; fields an admin edited are locked.
- Picking a map place in any flow creates the workplace at once (or matches it), so abandoned reviews still leave a "No reviews yet" page.

### Search
- `/search` shows workplaces already on RateThatJob first (with score), then map places (Google Places, OpenStreetMap fallback) under "Pick the one you mean", using "Where" as the place bias. Opening a map place that isn't on RateThatJob creates its workplace page on the click (one per place id, rate-limited). Empty search shows popular places nearby. Map API calls are counted per day for the monthly budget.

### SEO checklist per location page
- SSR/ISR, revalidate on new review or reply.
- `<title>`: `Working at {Company} ({Location}) – reviews, pay, hours | RateThatJob`
- Meta description generated from facts: score, % paid on time, reply rate.
- **Structured data (JSON-LD):** `EmployerAggregateRating` (schema.org, supported by Google for employer ratings) with `itemReviewed` = Organization/LocalBusiness, `ratingValue`, `ratingCount`. Validate with Google Rich Results Test. Breadcrumbs (`BreadcrumbList`).
- Dynamic OG images via `next/og` (one route, `/api/og`): base (tagline), employers, Index, Careers Hub, jobs, job (title, company, city, pay), location (score + facts), company and city hub (name + score, else "Be the first to rate"), sample page; EN/HU. Every public page has og:* tags and `twitter:card=summary_large_image`.
- XML sitemaps split by type and chunked (companies, locations, cities, open jobs), plus sitemap index. Include `lastmod` and `xhtml:link` hreflang pairs. A location, company or city page is in the sitemap (and indexable) with a published review or an employer-filled profile.
- Empty / thin pages (0 reviews): `noindex` until the first published review, unless the employer filled the profile (about, benefits or photos).
- Core Web Vitals budget: LCP < 2.0s on mobile.
- Internal linking: city hubs → locations, company page → all locations, "similar workplaces nearby".

---

## 4. Data model (Postgres)

Main tables (all with `id uuid`, `created_at`, `updated_at`):

**Identity**
- `users` – Supabase auth user.
- `profiles` – `user_id`, `display_mode` (`generated` | `username`), `generated_name` (e.g. "Quiet Oak 42"), `username` (unique, nullable), `avatar_seed`, `preferred_locale`.
- Private contact data stays in auth tables only; never joined into public views.

**Companies & locations**
- `companies` – `name`, `slug`, `category`, `website`, `logo_url`, `claimed_at`, `owner_org_id`.
- `legal_entities` – `name` (e.g. "Example Trade LLC"), `country`, `registry_id` (company reg. number), `registry_source`.
- `locations` – `company_id`, `name` (trade name, e.g. "Joe's Pizzeria"), `slug`, `address`, `city`, `country`, `lat`, `lng`, `google_place_id`, `category`, `is_seeded`.
- `location_entity_links` – `location_id`, `legal_entity_id`, `source` (`document` | `registry` | `claim` | `admin`), `confidence`, `confirmations_count`, `verified_at`. A link becomes **verified** after 2–3 independent document confirmations, a registry match, or an employer claim.
- `slug_redirects` – `old_path`, `new_path`.

**Employer side**
- `orgs` – employer account (billing owner).
- `org_members` – `org_id`, `user_id`, `role` (`owner` | `hr` | `location_manager`), `location_ids` (for location managers).
- `location_plans` – `location_id`, `plan` (`free` | `pro`), `stripe_subscription_item_id`, `billing_interval` (`month` | `year`), `status`.

**Reviews**
- `reviews`
  - `user_id`, `location_id`
  - `relationship` (`applicant` | `trial_shift` | `current` | `former`), `period_start`, `period_end`
  - `position`, `work_type` (`permanent` | `temporary`)
  - ratings 1–5: `overall`, `manager`, `pay`, `schedule`, `environment`
  - facts (nullable booleans): `paid_as_promised`, `paid_on_time`, `overtime_paid`, `hours_as_promised`, `would_return`
  - applicant facts: `got_reply` (bool), `reply_days` (int), `interview_rounds` (int)
  - `body` (optional, one field: "Anything others should know?"), `original_language`
  - `publish_mode` (always `now`; the old `delayed` / `after_leaving` values are no longer accepted), `publish_at`, `published_at`
  - `verification_level` (`none` | `document` | `invited` | `application`)
  - `invite_id` (nullable; **never exposed to employer**)
  - `status` (`draft` | `pending_moderation` | `scheduled` | `published` | `rejected` | `removed`)
- `review_translations` – `review_id`, `locale`, `body`, `model`, `created_at`.
- `employer_replies` – `review_id`, `org_member_id`, `body`, `original_language`; + `reply_translations`.
- `verifications` – `review_id`, `storage_path`, `doc_type`, `detected_legal_entity`, `status`, `reviewed_by`, `deleted_at`. File kept 30 days after the decision, then deleted by a daily job; a short record stays (doc type, who checked, when, result).
- `disputes` – employer disputes on **unverified** reviews only; `reason`, `status`. Employers can never delete reviews.
- `reports` – user reports, moderation queue.
- `helpful_votes` (later).

**Invites**
- `invite_batches` – `location_id`, `org_id`, `channel_mix`, `created_by`, `sent_count`.
- `invites` – `batch_id`, `channel` (`email` | `link`), `contact_encrypted` (deleted after the reminder window), `contact_hash`, `token`, `sent_at`, `reminded_at`, `opened_at`, `used_at`.
- Employers only ever see batch-level counts: invites sent, reviews received – and **received counts are shown only when ≥ 5**.

**Aggregates (materialized / cached)**
- `location_scores` – rolling 12 months: weighted overall, per-category averages, fact percentages, ghosting metric (reply rate + avg reply days), review counts, verified counts, invited ratio, trend vs previous period.

---

## 5. Reviewer flows

### 5.1 Sign-up (one tap)
- Buttons: Continue with Apple / Google / Facebook, email OTP (no password).
- After first login: choose display name → generated anonymous name (shuffle button) or own username. Changeable anytime.
- Account belongs to the worker, not the employer; it moves with them between jobs.

### 5.2 Entry points
1. Search → location page → "Rate this job".
2. Employer invite link (`/r/{token}`) → location preselected → sign-up → review. Review gets `verification_level = invited`.
3. "Add a missing workplace" (Google Places autocomplete).

### 5.3 Review form (target: 1 minute, 3 steps)
1. Relationship, period, position, permanent/temporary.
2. Ratings (5 categories) + would you work there again.
3. Facts yes/no (+ applicant questions if relationship = applicant), optional text in any language.
4. Verify (optional document upload) + preview of display name. No publish timing choice: the form says when it goes live (3–12 days after sending, random day and time).

### 5.4 Publishing pipeline (background job)
1. Moderation (LLM + rules). Flag names, phone numbers, threats → manual queue.
2. Language detection → translate into all active UI locales → `review_translations`.
3. Anonymity guard: every review goes live at a uniformly **random moment 3–12 days** after it is sent (random day and time); reviews from the same invite batch go live together at one moment in the same window.
5. Recompute `location_scores`, revalidate ISR pages, notify followers.

---

## 6. Verification

Levels shown as badges: Not verified · Verified (document) · Verified (invited) · Verified (application, later).

- Document upload: payslip, contract, employment letter. UI asks to cover everything except company name and date.
- Check: manual admin queue in MVP; later LLM/OCR extracts legal entity name + date.
- Legal entity from the document feeds `location_entity_links` (the "Joe's Pizzeria = Example Trade LLC" problem). Unknown entity → review stays pending until a second source confirms or an admin approves.
- Score weighting: verified reviews weight 1.0, unverified 0.5 (tunable).

### Fraud signals
- Burst of new accounts reviewing the same location, same device/IP, accounts created minutes before reviewing, reviewers active at a competitor nearby. Hold suspicious reviews for manual check.

---

## 7. Employer side (`/business`)

- **Access request ("claim"):** free; public copy says "Request free access" / "Hozzáférés igénylése". Three ways to verify, each with a photo ID of the person (number and everything but photo and name may be covered): (a) business email – the signed-in, code-verified email's domain matches the company website (freemail never); (b) company registry extract / UAE trade license naming the person as director or owner; (c) letter of authorization signed by the legal representative (fillable PDF + DOCX form in EN/HU at `/forms/rtj-authorization-<locale>.pdf|docx`). No phone method. Documents go to the private `claim-documents` bucket, only admins open them through short-lived signed links (every opening logged: who, when, which file), kept 30 days after the decision and then deleted by a daily job; a short record without file or personal data stays. The admin card shows the method, the domain match and both documents. Approval also confirms the legal entity link.
- **Overview:** score, verified count, applicant reply rate, reviews awaiting reply, early warnings, per-location table.
- **Early warnings (Pro):** detect drops in a category score (e.g. −0.5 within 60 days) or recurring topics (LLM topic clustering on recent reviews) per location; email + dashboard alert.
- **Early signals (Pro, part of early warnings):** before reviews go live, the employer sees anonymous, aggregated themes per location, so it can act – without weakening anonymity (the publishing delays stay as they are). Rules:
  - Input: all reviews of the location sent in the last 30 days, waiting to go live or already published (held, rejected and removed ones out).
  - Nothing is shown below 5 reviews in the last 30 days; no counts at all.
  - Themes: an LLM summary (cheap model) of the review texts, a theme only when at least 3 different reviewers mention it; it never quotes and has no names, job titles, dates or numbers (prompt + filter afterwards: 4-word overlap, digits, quotes, dates, reviewers' positions).
  - Directions per rating category ("incoming reviews about pay point downward"), from the last 30 days' reviews against the reviews published in the 12 months before, without numbers (step 0.5, at least 3 ratings on both sides).
  - Publishing is never affected: the employer can't hold back or delay a review.
  - Refreshed daily by a cron, only re-summarized when the input changed; email to owners/HR when a new theme category appears, at most once a week.
  - Transparency: one sentence at the publish step of the review form; privacy policy section on early signals.
  - Pro lock: without Pro (trial included) only a blurred preview without any data and a "With Pro you see early signals" link; shown on the business overview and the location's statistics page.
- **Reviews & replies:** reply in any language (auto-translated for readers), dispute unverified reviews. No deletion.
- **Invite your team (Pro, or limited on Free):** pick location → CSV upload (name optional, email; private emails fine) / add one by one / shareable link → message template per recipient language → send by email, one reminder after 5 days. No SMS. Every invite email has an unsubscribe link (one-click too); unsubscribed addresses are kept as a hash only and never invited again. Limits: 200 addresses per send, no repeat invite to the same person and location within 90 days, daily caps per location and org.
- **Locations, team & roles:** owner (all + billing), HR (all locations, replies, invites), location manager (own location only).
- **Plan & billing:** per-location Free/Pro, monthly or yearly (2 months free). Chains 10+ locations: custom. Public pricing shows only the page language's currency (HU → Ft, EN → €; one currency per language); the workplace pays in its country's currency (HUF for Hungary, EUR elsewhere), shown in the business area before paying, with a short note when it differs from the page language.
- **Free trial:** every location gets 30 days of Pro free, once per location; it starts automatically when the claim is approved (`location_plans.status = 'trialing'`, `trial_ends_at`). Notices 7 and 1 day(s) before the end and once after it (in-app + email). After that Pro is paid: Stripe Checkout subscription per location (HUF for Hungary, EUR elsewhere; subscribing during the trial charges first at the trial end), renews automatically, cancel at period end in the Stripe Customer Portal; paying by invoice/transfer stays possible (admin marks it paid, `paid_until`). Job ads are paid once at publishing (difference on upgrade) and go live only when paid. Invoices: the buyer must give a billing address and a tax ID where Stripe supports one; EU businesses with an EU VAT number are invoiced with reverse charge (customer `tax_exempt = reverse`), buyers outside the EU and the UAE as exempt, UAE buyers normally (no Stripe Tax; seller details, our TRN and the reverse charge text go into the Stripe invoice footer from code). The plan page shows the billing name, address and tax ID and links to the invoices in the Customer Portal.

- **Subscription page** (`/business/billing`): per location the plan, price and interval, a clear state (Free trial / Active / Payment failed / Cancelled / Expired / Free), days left with a progress bar in the trial, next charge date and amount, card brand, last 4 digits and expiry, the access end after cancelling (with Reactivate), a red band to update the card after a failed payment; buttons open the matching Customer Portal flow (start, switch to yearly with the saving, change card, cancel, invoices). Billing details and the latest invoices (PDF) at the bottom. The dashboard shows a banner during the trial (louder in the last 7 days) and after a failed payment.
- **Billing emails** (once each, owners and HR): trial ends in 7 and 1 day(s), trial ended, yearly renewal in 7 days, payment failed, cancellation confirmed.

Pro features per location (what the code gates today): early warnings, statistics, and the **RateThatJob Index** on embeds (image badge, iframe card, Top Rated seal, the score in the JSON API). Free for every employer: replies, disputes, invite link and email invites, workplace profile (photos, benefits), job ads (paid per ad) and RateThatJob Careers Hub. Not built: removing competitor suggestions from your own page.

---

## 8. RateThatJob Index (embeddable widget)

Goal: employers show their score on their careers page / job ads; every embed is a backlink.

- Endpoints:
  - `GET /embed/{location_id}.svg` – static badge (score, verified count, "Know before you go"). Cache 1h.
  - `GET /embed/{location_id}` – small HTML card for iframe use.
  - `GET /api/public/locations/{id}/index` – JSON (score, counts, facts %, updated_at). Rate-limited, CORS open.
- Embed code generator in dashboard (Pro): employer picks variant, size and theme, copies one snippet.
- Badge always links back to the public location page.
- Show score only when the location has ≥ 5 published reviews; otherwise "Rate us on RateThatJob".
- The Index on embeds needs Pro (trial or paid). Without it, embeds don't disappear: badge, card and seal say "RateThatJob Index currently unavailable. Employer: sign in to your account to activate it." and still link to the public location page (which always shows reviews and scores); the JSON API returns `status: "inactive"` and no score.

### 8.1 Variants (see design canvas, boards I1–I2)
- **Compact badge** – light / dark: icon, score, "RateThatJob Index", verified review count.
- **Wide card** – for careers pages: score tile, location name, 2 facts with bars (paid on time, replies to applicants), "RateThatJob.com · Know before you go".
- **Inline strip** – one line for job ads: "4.2 on RateThatJob · Paid on time 82% · Replies to 64% of applicants".
- **Top Rated Employer {year} seal** – rounded square, dark or light (`?style=light`); earned at score ≥ 4.0 with ≥ 10 verified reviews in the last 12 months; renewed yearly; endpoint `GET /embed/{location_id}/seal.svg`, returns 404/placeholder if not earned.
- **Fewer than 5 reviews** – "Rate us on RateThatJob / Worked here? Share your experience." links to the review flow for that location.

### 8.2 Embed methods (offer all three)

**1. Image badge (simplest, works anywhere images + links are allowed: careers pages, Wix/WordPress without code, email signatures)**
```html
<a href="https://ratethatjob.com/joes-pizzeria/w-46th-st">
  <img src="https://ratethatjob.com/embed/LOCATION_ID.svg" alt="Joe's Pizzeria on RateThatJob">
</a>
```
- SVG generated server-side on request with the current score; cached ~1h at the edge; query params for variant/theme (`?style=compact-dark`).

**2. Script widget (live card, wide variant)**
```html
<div class="rtj-index" data-location="LOCATION_ID" data-style="wide-dark">
  <a href="https://ratethatjob.com/joes-pizzeria/w-46th-st">Joe's Pizzeria on RateThatJob</a>
</div>
<script src="https://ratethatjob.com/widget.js" async></script>
```
- `widget.js`: tiny (< 15 KB gzip), no dependencies, renders inside Shadow DOM so host CSS can't break it, finds all `.rtj-index` elements, fetches the public JSON, supports `data-style` (`compact-light`, `compact-dark`, `wide-light`, `wide-dark`, `strip`, `seal`) and `data-locale`.
- The inner `<a>` is the fallback: if JS doesn't run, a crawlable backlink remains.
- Lazy-load when scrolled into view; no cookies, no tracking of host visitors beyond an anonymous impression counter.

**3. Public JSON API (for developers who want their own design)**
- `GET /api/public/locations/{id}/index` → `{ score, rating_count, verified_count, facts: { paid_on_time, paid_as_promised, overtime_paid, hours_as_promised, reply_rate, avg_reply_days }, top_rated, profile_url, updated_at }`
- CORS open, rate-limited per IP and per location, cacheable.

### 8.3 Limits and notes
- Big job boards (e.g. Profession, Indeed) usually don't allow custom HTML in ads → use the inline text strip + link there; partner integrations later.
- On our own job pages (Phase 3) the full widget is shown natively.
- Track embeds: count distinct referring domains per location (shown to the employer, also a growth metric for us).

### 8.4 RateThatJob Careers Hub (jobs widget)
- Product name: **RateThatJob Careers Hub** (short: Careers Hub, not translated). Tagline: "Your jobs, on your website. Backed by your Index." / HU "Az állásaid a saját weboldaladon. Mellettük az Indexed." Marketing page: `/careers-hub`.
- Same `widget.js`, new element: `<div data-rtj-jobs="job|location|company" data-id="ID or company slug" data-theme="light|dark" data-locale="en|hu"><a href="…">fallback link</a></div>`. The inner link stays as a crawlable fallback without JS.
- Renders in Shadow DOM: job cards with title, pay, schedule, Quick apply badge; featured (Pro) jobs first.
- The RateThatJob Index is always shown under the jobs (score from 5 reviews, otherwise "Rate us on RateThatJob"), following the Pro rule above (without Pro or trial: "currently unavailable"); employers cannot turn it off. For a company the score is the review-weighted average of its locations with Pro.
- Data: `GET /api/public/jobs?job=ID | ?location=ID | ?company=SLUG [&locale=]` → open, published jobs only (from `public_jobs`), display strings in the requested language, never user data. CORS open, browser-cached (so `recordEmbed()` counts every site), rate-limited per IP.
- "Apply" opens our apply flow in a new tab with `?ref=embed&from=<host page URL>`; the application is stored with `source = 'embed'`, and the done screen offers "Back to the company's website" (http/https only).
- Generator: "Careers Hub" tab on `/business/index` (one job / location / whole company, theme, language, live preview, copyable code). Free for every claimed employer, with or without Pro.

---

## 9. Localization

- Launch locales: `en`, `hu`. Add `de` next.
- All UI strings in message files from the first commit; no hard-coded copy.
- Locale detection: URL prefix > profile setting > `Accept-Language`.
- User content: store original + translations; reader sees their locale with "Translated · Show original"; untranslated content shows a small "Original: {language}" tag. Applies to reviews, employer replies and application messages.
- Employer invite messages sent in each recipient's language when known, otherwise the location's country language.
- Dates, numbers, currency via `Intl`.

---

## 10. Privacy & anonymity rules (enforce in code + RLS)

- Public API and employer views never return `user_id`, contact data, `invite_id` or device data for reviews.
- Employer-facing aggregates require **n ≥ 5**.
- Invite contact data encrypted at rest and deleted after the reminder window.
- Proof documents (review proofs and access-request documents) kept 30 days after the decision, then deleted; admin access logged.
- Users can export and delete their account; deleting an account anonymizes their reviews (keeps them as "Former member") or removes them – user's choice.

---

## 11. MVP scope and phases

**Phase 1 – MVP (validate supply of reviews)**
- Public: home/search, company page, location page, reviews list with translation, city hubs.
- Reviewer: one-tap auth, display name, 3-step review, document verification (manual), random 3–12 day publishing delay.
- Employer: free claim, replies, disputes, basic invites.
- Admin: moderation queue, verification queue, entity linking, location seeding import (CSV + Google Places).
- SEO: SSR/ISR, slugs, sitemaps, JSON-LD, hreflang, OG images.

**Phase 2 – Monetization**
- Stripe per-location Pro, early warnings, statistics, Index widget, branded profile, full invites with reminders.

**Phase 3 – Jobs**
- Job posts on location pages, easy CV-free apply (short question set), application tracking → automatic ghosting metric and `verification_level = application` reviewers.
- Languages per job: the ad's original language and optional expected languages with level (basic / conversational / fluent / native). Shown on the job page, cards, Careers Hub widget and JobPosting JSON-LD; `/jobs` language filter; applicants answer "Do you speak X?" as must-have questions; the AI candidate summary takes them into account.

### PMF signals to track from day one
- Verified reviews per month in the launch segment without paid ads.
- % of locations claimed organically.
- Organic search traffic to location pages.
- Invite → review conversion.

---

## 12. Brand

- Name: **RateThatJob.com** (wordmark includes ".com", lighter weight)
- Tagline: **Know before you go**
- Font: **Archivo** (Google Fonts) – Black 900 for headings/wordmark (letter-spacing −3%), Medium 500 for body/.com, tagline uppercase +16% tracking.
- Colors:
  - Signal Green `#3DDC97` – accent, icon, primary CTA on dark
  - Ink `#14161A` – text, dark backgrounds, primary buttons
  - Paper `#F4F2EE` – light background
  - Slate `#4A4F57` – secondary text on light
  - Mist `#B5BAC1` – secondary text on dark
- Icon: green speech bubble with a dark check mark.
- Never use green as text on light backgrounds (contrast).
- Screen designs: see the "RateThatJob mobil képernyők" design canvas (10 mobile screens, 2 desktop candidate pages, 4 employer dashboard pages).

---

## 13. Suggested repo structure

```
/app
  /[locale]/(public)/page.tsx                       home
  /[locale]/(public)/[company]/page.tsx             company
  /[locale]/(public)/[company]/[location]/page.tsx  location
  /[locale]/(public)/city/[city]/...                city hubs
  /[locale]/app/...                                 reviewer area (noindex)
  /[locale]/business/...                            employer dashboard (noindex)
  /r/[token]/route.ts                               invite redirect
  /embed/[id]/...                                   widget
  /api/...                                          public + internal APIs
  /sitemap.ts, /robots.ts
/lib (db, auth, i18n, scoring, translation, moderation, seo)
/messages/en.json, /messages/hu.json
/supabase/migrations
/jobs (publish pipeline, translations, reminders, early warnings, scores)
```

First tasks for Claude Code:
1. Scaffold Next.js + Supabase + next-intl + Tailwind with brand tokens.
2. Write migrations for section 4 with RLS policies.
3. Build public location page with SSR, JSON-LD and seeded sample data.
4. Build auth + display name + 3-step review flow.
5. Build publish pipeline (moderation stub, translation, delayed publishing, score recompute).
