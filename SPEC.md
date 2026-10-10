# RateThatJob.com – Product & Technical Spec (v0.1)

> Hand this file to Claude Code as the project brief. Put it in the repo root as `SPEC.md` and reference it from `CLAUDE.md`.
> Tagline: **Know before you go.**

---

## 1. What we are building

A workplace review platform focused on **location-level, frontline / hourly work** (restaurants, retail, warehouses, factories), also open to office jobs and startups.

Core promise to workers: verified reviews and hard facts (pay on time, overtime paid, promised hours, does the employer reply to applicants).
Core promise to employers: claim your workplace for free, reply to reviews, invite your team, see early warnings per location.

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
| Hosting | **Vercel** | Edge caching, ISR revalidation, OG image generation |
| Database | **Postgres (Supabase)** | Row Level Security on every table |
| Auth | **Supabase Auth** | Apple, Google, Facebook, email OTP (passwordless), phone OTP. TikTok via TikTok Login Kit as a custom OAuth flow (check current Supabase provider support first) |
| File storage | Supabase Storage, **private bucket** | Verification documents only; auto-delete after review |
| Styling | Tailwind CSS | Design tokens from section 12 |
| i18n | next-intl | Locale routing, ICU messages |
| Machine translation | LLM API (e.g. Claude) | Translate on publish, cache in DB |
| Moderation | LLM classifier + rules | Personal data, hate, threats; queue for manual review |
| Email | Resend (or Postmark) | Invites, reminders, notifications |
| SMS | Twilio | Phone OTP fallback, SMS invites |
| Payments | Stripe Billing | Subscription per location (quantity-based), monthly / yearly |
| Places data | Google Places API | Location autocomplete, seeding, address normalization |
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

### SEO checklist per location page
- SSR/ISR, revalidate on new review or reply.
- `<title>`: `Working at {Company} ({Location}) – reviews, pay, hours | RateThatJob`
- Meta description generated from facts: score, % paid on time, reply rate.
- **Structured data (JSON-LD):** `EmployerAggregateRating` (schema.org, supported by Google for employer ratings) with `itemReviewed` = Organization/LocalBusiness, `ratingValue`, `ratingCount`. Validate with Google Rich Results Test. Breadcrumbs (`BreadcrumbList`).
- Dynamic OG image per location (score + facts) via `next/og`.
- XML sitemaps split by type and chunked (companies, locations, cities), plus sitemap index. Include `lastmod`.
- Empty / thin pages (0 reviews): indexable only if they have useful seeded data (address, category, facts placeholder + "Be the first to rate"); otherwise `noindex` until first review.
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
  - `body_pros`, `body_cons` (optional), `original_language`
  - `publish_mode` (`now` | `delayed` | `after_leaving`), `publish_at`, `published_at`
  - `verification_level` (`none` | `document` | `invited` | `application`)
  - `invite_id` (nullable; **never exposed to employer**)
  - `status` (`draft` | `pending_moderation` | `scheduled` | `published` | `rejected` | `removed`)
- `review_translations` – `review_id`, `locale`, `body_pros`, `body_cons`, `model`, `created_at`.
- `employer_replies` – `review_id`, `org_member_id`, `body`, `original_language`; + `reply_translations`.
- `verifications` – `review_id`, `storage_path`, `doc_type`, `detected_legal_entity`, `status`, `reviewed_by`, `deleted_at`. Delete file after decision (max 30 days).
- `disputes` – employer disputes on **unverified** reviews only; `reason`, `status`. Employers can never delete reviews.
- `reports` – user reports, moderation queue.
- `helpful_votes` (later).

**Invites**
- `invite_batches` – `location_id`, `org_id`, `channel_mix`, `created_by`, `sent_count`.
- `invites` – `batch_id`, `channel` (`email` | `sms` | `link`), `contact_encrypted` (deleted after the reminder window), `contact_hash`, `token`, `sent_at`, `reminded_at`, `opened_at`, `used_at`.
- Employers only ever see batch-level counts: invites sent, reviews received – and **received counts are shown only when ≥ 5**.

**Aggregates (materialized / cached)**
- `location_scores` – rolling 12 months: weighted overall, per-category averages, fact percentages, ghosting metric (reply rate + avg reply days), review counts, verified counts, invited ratio, trend vs previous period.

---

## 5. Reviewer flows

### 5.1 Sign-up (one tap)
- Buttons: Continue with Apple / Google / Facebook / TikTok, email OTP (no password), phone OTP.
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
4. Verify (optional document upload) + publish timing (now / delayed / after I leave) + preview of display name.

### 5.4 Publishing pipeline (background job)
1. Moderation (LLM + rules). Flag names, phone numbers, threats → manual queue.
2. Language detection → translate into all active UI locales → `review_translations`.
3. Anonymity guard: if location has < 5 published reviews or the review came from an invite batch, apply **random delay** (e.g. 2–14 days) and publish in groups.
4. Respect `publish_mode`.
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

- **Claim:** free. Verify by business email domain, phone call to listed number, or document (registry extract). Claim also confirms the legal entity link.
- **Overview:** score, verified count, applicant reply rate, reviews awaiting reply, early warnings, per-location table.
- **Early warnings (Pro):** detect drops in a category score (e.g. −0.5 within 60 days) or recurring topics (LLM topic clustering on recent reviews) per location; email + dashboard alert.
- **Reviews & replies:** reply in any language (auto-translated for readers), dispute unverified reviews. No deletion.
- **Invite your team (Pro, or limited on Free):** pick location → CSV upload (name optional, email or phone; private emails fine) / add one by one / shareable link → message template per recipient language → send by email/SMS, one reminder after 5 days.
- **Locations, team & roles:** owner (all + billing), HR (all locations, replies, invites), location manager (own location only).
- **Plan & billing:** per-location Free/Pro, monthly or yearly (2 months free). Chains 10+ locations: custom.

Pro features per location: early warnings, invites, statistics, branded profile (photos, benefits), remove competitor suggestions from own page, **RateThatJob Index** widget.

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

### 8.1 Variants (see design canvas, boards I1–I2)
- **Compact badge** – light / dark: icon, score, "RateThatJob Index", verified review count.
- **Wide card** – for careers pages: score tile, location name, 2 facts with bars (paid on time, replies to applicants), "RateThatJob.com · Know before you go".
- **Inline strip** – one line for job ads: "4.2 on RateThatJob · Paid on time 82% · Replies to 64% of applicants".
- **Top Rated Employer {year} seal** – earned at score ≥ 4.0 with ≥ 10 verified reviews in the last 12 months; renewed yearly; endpoint `GET /embed/{location_id}/seal.svg`, returns 404/placeholder if not earned.
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

---

## 9. Localization

- Launch locales: `en`, `hu`. Add `de` next.
- All UI strings in message files from the first commit; no hard-coded copy.
- Locale detection: URL prefix > profile setting > `Accept-Language`.
- User content: store original + translations; reader sees their locale with "Translated from X · Show original".
- Employer invite messages sent in each recipient's language when known, otherwise the location's country language.
- Dates, numbers, currency via `Intl`.

---

## 10. Privacy & anonymity rules (enforce in code + RLS)

- Public API and employer views never return `user_id`, contact data, `invite_id` or device data for reviews.
- Employer-facing aggregates require **n ≥ 5**.
- Invite contact data encrypted at rest and deleted after the reminder window.
- Verification files deleted after decision.
- Users can export and delete their account; deleting an account anonymizes their reviews (keeps them as "Former member") or removes them – user's choice.

---

## 11. MVP scope and phases

**Phase 1 – MVP (validate supply of reviews)**
- Public: home/search, company page, location page, reviews list with translation, city hubs.
- Reviewer: one-tap auth, display name, 3-step review, document verification (manual), publish timing.
- Employer: free claim, replies, disputes, basic invites.
- Admin: moderation queue, verification queue, entity linking, location seeding import (CSV + Google Places).
- SEO: SSR/ISR, slugs, sitemaps, JSON-LD, hreflang, OG images.

**Phase 2 – Monetization**
- Stripe per-location Pro, early warnings, statistics, Index widget, branded profile, full invites with reminders.

**Phase 3 – Jobs**
- Job posts on location pages, easy CV-free apply (short question set), application tracking → automatic ghosting metric and `verification_level = application` reviewers.

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
