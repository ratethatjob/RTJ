import { getMessages } from "next-intl/server";

/** Only the namespaces client components in this subtree use, to keep pages light. */
export async function pickMessages(namespaces: string[]) {
  const all = await getMessages();
  return Object.fromEntries(namespaces.filter((n) => n in all).map((n) => [n, all[n]]));
}

export const SHARED_CLIENT_NAMESPACES = ["Nav", "NavAccount"];
