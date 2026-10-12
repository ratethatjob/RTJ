// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { type DueDocument, runDocumentDeletion } from "./document-retention-core.ts";

function fakeDb(due: DueDocument[], failBucket?: string) {
  const removed: string[] = [];
  const marked: string[] = [];
  const db = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === "documents_due") return { data: due, error: null };
      if (fn === "document_deleted") {
        marked.push(`${args.p_kind}:${args.p_id}`);
        return { data: null, error: null };
      }
      throw new Error(fn);
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          if (bucket === failBucket) return { error: new Error("storage down") };
          removed.push(...paths.map((p) => `${bucket}/${p}`));
          return { error: null };
        },
      }),
    },
  };
  return { db, removed, marked };
}

test("due files are removed from storage, then marked deleted (record written by the DB)", async () => {
  const { db, removed, marked } = fakeDb([
    { kind: "claim", id: "c1", bucket: "claim-documents", paths: ["u/c1/company.pdf", "u/c1/id.jpg"] },
    { kind: "review", id: "v1", bucket: "verifications", paths: ["u/proof.pdf"] },
  ]);
  assert.deepEqual(await runDocumentDeletion(db), { deleted: 2, failed: 0 });
  assert.deepEqual(removed, ["claim-documents/u/c1/company.pdf", "claim-documents/u/c1/id.jpg", "verifications/u/proof.pdf"]);
  assert.deepEqual(marked, ["claim:c1", "review:v1"]);
});

test("a storage failure keeps the paths, so the next run tries again", async () => {
  const { db, marked } = fakeDb(
    [
      { kind: "claim", id: "c1", bucket: "claim-documents", paths: ["u/c1/id.jpg"] },
      { kind: "review", id: "v1", bucket: "verifications", paths: ["u/proof.pdf"] },
    ],
    "verifications",
  );
  assert.deepEqual(await runDocumentDeletion(db), { deleted: 1, failed: 1 });
  assert.deepEqual(marked, ["claim:c1"]);
});

test("nothing due, nothing touched", async () => {
  const { db, removed, marked } = fakeDb([]);
  assert.deepEqual(await runDocumentDeletion(db), { deleted: 0, failed: 0 });
  assert.equal(removed.length + marked.length, 0);
});
