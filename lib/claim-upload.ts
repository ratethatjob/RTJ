import { createClient } from "@/lib/supabase/client";

// Claim documents (registry extract etc.) go to the private "claim-documents" bucket
// under <user id>/<claim id>/; only the claimant and admins can read them.

export const CLAIM_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const CLAIM_DOC_MAX = 10 * 1024 * 1024;

export const claimDocOk = (file: File) => CLAIM_DOC_TYPES.includes(file.type) && file.size <= CLAIM_DOC_MAX;

/** Uploads the file and returns its storage path, or null on failure. */
export async function uploadClaimDocument(userId: string, claimId: string, file: File): Promise<string | null> {
  if (!claimDocOk(file)) return null;
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/${claimId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient()
    .storage.from("claim-documents")
    .upload(path, file, { contentType: file.type });
  return error ? null : path;
}
