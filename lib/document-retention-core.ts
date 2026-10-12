// Proof documents (access requests: registry extract / trade license, authorization, photo ID;
// review proofs: payslip, contract …) are kept 30 days after the decision. Daily job: delete the
// storage objects that are due, then document_deleted() clears the paths and keeps a short record
// (type, who checked, when, result; no file, no personal data). Pure (takes the client) for tests.

export const DOCUMENT_RETENTION_DAYS = 30;

export type DueDocument = { kind: "claim" | "review"; id: string; bucket: string; paths: string[] };

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
export type RetentionClient = {
  rpc: Rpc;
  storage: { from(bucket: string): { remove(paths: string[]): PromiseLike<{ error: unknown }> } };
};

export async function runDocumentDeletion(db: RetentionClient): Promise<{ deleted: number; failed: number }> {
  const { data, error } = await db.rpc("documents_due", { p_limit: 200 });
  if (error) throw error;
  let deleted = 0;
  let failed = 0;
  for (const d of (data ?? []) as DueDocument[]) {
    const paths = d.paths.filter(Boolean);
    const removed = paths.length ? await db.storage.from(d.bucket).remove(paths) : { error: null };
    // Not removed: tried again tomorrow (the paths stay until the files are really gone).
    if (removed.error) {
      failed++;
      continue;
    }
    const marked = await db.rpc("document_deleted", { p_kind: d.kind, p_id: d.id });
    if (marked.error) failed++;
    else deleted++;
  }
  return { deleted, failed };
}
