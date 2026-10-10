import type { Metadata } from "next";

// Signed-in areas are never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: LayoutProps<"/[locale]/app">) {
  return children;
}
