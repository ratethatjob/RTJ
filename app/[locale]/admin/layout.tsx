import type { Metadata } from "next";

// Internal tooling: never indexed, always needs a session.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return children;
}
