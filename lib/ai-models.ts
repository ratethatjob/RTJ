import Anthropic from "@anthropic-ai/sdk";

// Every Claude model and output limit in one place. Cheapest model for the high-volume checks
// (translation, moderation), the mid-tier model for the employer's candidate help.

export const AI_MODELS = {
  translate: "claude-haiku-5-5",
  moderate: "claude-haiku-5-5",
  candidate: "claude-sonnet-5-5",
} as const;

export const AI_MAX_TOKENS = {
  // Up to 5 000 characters of text, in every locale.
  translate: 8000,
  moderate: 200,
  summary: 3000,
  followups: 1000,
} as const;

let client: Anthropic | null = null;

/** Shared client, or null without ANTHROPIC_API_KEY. One retry, short timeout: callers carry on without AI. */
export function aiClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ maxRetries: 1, timeout: 60_000 });
  return client;
}

/** The first text block of a finished response, or null (refusal, cut off, no text). */
export function responseText(response: { stop_reason: string | null; content: { type: string }[] }): string | null {
  if (response.stop_reason !== "end_turn") return null;
  const block = response.content.find((b) => b.type === "text") as { text?: string } | undefined;
  return block?.text ?? null;
}

/** Logs an API failure (no credit, rate limit, outage) in one line instead of throwing. */
export function logAiError(where: string, e: unknown) {
  const status = e instanceof Anthropic.APIError ? e.status : undefined;
  console.warn(`AI unavailable (${where})${status ? ` ${status}` : ""}: ${e instanceof Error ? e.message : String(e)}`);
}
