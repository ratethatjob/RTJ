import type { JobQuestion } from "./data/types";

// Languages on job ads: the ad's own language and the languages expected from applicants.
// Names come from Intl.DisplayNames, so no copy is hard-coded here.

export const JOB_LANGUAGES = [
  "en", "hu", "de", "fr", "es", "it", "pt", "ro", "sk", "pl", "uk", "ru", "ar", "hi", "ur", "tl", "ml", "zh",
] as const;
export const LANGUAGE_LEVELS = ["basic", "conversational", "fluent", "native"] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];
export type JobLanguage = { code: string; level: LanguageLevel };

export const MAX_LANGUAGES = 6;

export { languageName } from "./intl-names";

export const isLanguageCode = (v: unknown): v is string =>
  typeof v === "string" && (JOB_LANGUAGES as readonly string[]).includes(v);

/** Cleans the employer's language list; null when invalid. */
export function parseLanguages(input: unknown): JobLanguage[] | null {
  if (!Array.isArray(input) || input.length > MAX_LANGUAGES) return null;
  const seen = new Set<string>();
  const out: JobLanguage[] = [];
  for (const raw of input) {
    const l = raw as Record<string, unknown>;
    if (!isLanguageCode(l?.code) || !(LANGUAGE_LEVELS as readonly string[]).includes(l.level as string)) return null;
    if (seen.has(l.code)) return null;
    seen.add(l.code);
    out.push({ code: l.code, level: l.level as LanguageLevel });
  }
  return out;
}

/** Answer id for "do you speak X at the expected level?". */
export const languageQuestionId = (code: string) => `lang${code}`;

/**
 * Every expected language becomes a must-have yes/no question, asked like the employer's own
 * must-haves. `text` writes the question in the reader's language.
 */
export function languageQuestions(languages: JobLanguage[], text: (l: JobLanguage) => string): JobQuestion[] {
  return languages.map((l) => ({ id: languageQuestionId(l.code), text: text(l), type: "yes_no", required: true, must: "yes" }));
}
