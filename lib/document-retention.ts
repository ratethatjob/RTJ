import { type RetentionClient, runDocumentDeletion } from "@/lib/document-retention-core";
import { adminClient } from "@/lib/supabase/admin";

/** Daily job (/api/cron/documents): proof documents 30 days after the decision are deleted. */
export async function deleteDueDocuments() {
  const db = adminClient();
  if (!db) return { deleted: 0, failed: 0 };
  return runDocumentDeletion(db as unknown as RetentionClient);
}
