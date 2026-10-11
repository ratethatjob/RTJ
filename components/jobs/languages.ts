import type { Job } from "@/lib/data/types";
import { type JobLanguage, languageName, languageQuestions } from "@/lib/languages";

// t is a "Jobs" translator (server or client).
type T = (key: string, values?: Record<string, string | number>) => string;

/** "English – conversational · Hungarian – basic" */
export function languageList(languages: JobLanguage[], locale: string, t: T) {
  return languages
    .map((l) => t("languageLevel", { language: languageName(l.code, locale), level: t(`levels.${l.level}`) }))
    .join(" · ");
}

/** The employer's questions plus one must-have "do you speak …?" per expected language. */
export function jobQuestions(job: Pick<Job, "questions" | "languages">, locale: string, t: T) {
  return [
    ...job.questions,
    ...languageQuestions(job.languages, (l) =>
      t("speakQuestion", { language: languageName(l.code, locale), level: t(`levels.${l.level}`) }),
    ),
  ];
}
