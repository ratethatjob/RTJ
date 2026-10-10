import type { JobQuestion } from "./data/types";

export const MAX_QUESTIONS = 15;

/** Preset yes/no questions employers can add with one click (text comes from messages). */
export const PRESET_QUESTIONS = [
  "weekends",
  "nights",
  "shifts",
  "startSoon",
  "workPermit",
  "foodCard",
  "driving",
  "lifting",
  "standing",
  "experience",
  "language",
  "student",
] as const;

/** Cleans an employer's question set; returns null when it is not valid. */
export function parseQuestions(input: unknown): JobQuestion[] | null {
  if (!Array.isArray(input) || input.length > MAX_QUESTIONS) return null;
  const out: JobQuestion[] = [];
  const ids = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const q = raw as Record<string, unknown>;
    const id = typeof q.id === "string" && /^[a-z0-9]{1,12}$/.test(q.id) ? q.id : null;
    const text = typeof q.text === "string" ? q.text.trim() : "";
    const type = q.type === "text" ? "text" : q.type === "yes_no" ? "yes_no" : null;
    if (!id || ids.has(id) || !type || text.length < 3 || text.length > 200) return null;
    ids.add(id);
    const must = type === "yes_no" && (q.must === "yes" || q.must === "no") ? q.must : null;
    out.push({ id, text, type, required: must ? true : Boolean(q.required), must });
  }
  return out;
}

export type Answers = Record<string, boolean | string>;

/** Checks an applicant's answers; returns the cleaned answers or null when a required one is missing. */
export function parseAnswers(questions: JobQuestion[], input: unknown): Answers | null {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Answers = {};
  for (const q of questions) {
    const v = raw[q.id];
    if (q.type === "yes_no") {
      if (typeof v === "boolean") out[q.id] = v;
      else if (q.required) return null;
    } else {
      const text = typeof v === "string" ? v.trim().slice(0, 1000) : "";
      if (text) out[q.id] = text;
      else if (q.required) return null;
    }
  }
  return out;
}

/** Must-have questions the answers don't meet. */
export function unmetMusts(questions: JobQuestion[], answers: Answers): JobQuestion[] {
  return questions.filter((q) => q.must && answers[q.id] !== (q.must === "yes"));
}
