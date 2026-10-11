"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProfile } from "@/app/[locale]/business/profile/actions";
import { createClient } from "@/lib/supabase/client";
import { supabaseUrl } from "@/lib/supabase/env";

type Props = {
  locationId: string;
  initial: { about: string; website: string; benefits: string; photos: string[] };
};

const MAX_PHOTOS = 6;

export function ProfileForm({ locationId, initial }: Props) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [about, setAbout] = useState(initial.about);
  const [website, setWebsite] = useState(initial.website);
  const [benefits, setBenefits] = useState(initial.benefits);
  const [photos, setPhotos] = useState(initial.photos);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const url = (path: string) => `${supabaseUrl}/storage/v1/object/public/profile-photos/${path}`;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    setUploading(true);
    const supabase = createClient();
    const added: string[] = [];
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
        setMessage(t("photoError"));
        continue;
      }
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${locationId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("profile-photos").upload(path, file, { contentType: file.type });
      if (error) setMessage(t("photoError"));
      else added.push(path);
    }
    setPhotos((p) => [...p, ...added]);
    setUploading(false);
  }

  const input = "w-full rounded-2xl border border-mist/60 bg-white px-4 py-3 text-lg outline-none focus:border-ink";

  return (
    <form
      className="flex flex-col gap-5 rounded-3xl bg-white p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await saveProfile(locationId, { about, website, benefits, photos });
          if (result.error) return setMessage(result.error === "invalid" ? t("invalid") : t("error"));
          setMessage(t("saved"));
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="font-black">{t("about")}</span>
        <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={5} maxLength={2000} placeholder={t("aboutPlaceholder")} className={input} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-black">{t("benefits")}</span>
        <span className="text-sm text-slate">{t("benefitsHint")}</span>
        <textarea value={benefits} onChange={(e) => setBenefits(e.target.value)} rows={5} placeholder={t("benefitsPlaceholder")} className={input} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-black">{t("website")}</span>
        <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className={input} />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-black">{t("photos", { count: photos.length, max: MAX_PHOTOS })}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p) => (
            <div key={p} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded photo */}
              <img src={url(p)} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos(photos.filter((x) => x !== p))}
                aria-label={t("removePhoto")}
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ink font-black text-paper"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {photos.length < MAX_PHOTOS && (
          <label className="self-start cursor-pointer rounded-2xl border-2 border-ink px-5 py-2.5 font-black">
            {uploading ? t("uploading") : t("addPhotos")}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
          </label>
        )}
      </fieldset>

      {message && <p className="rounded-2xl bg-paper p-4 font-black">{message}</p>}
      <button type="submit" disabled={pending || uploading} aria-busy={pending} className="self-start rounded-2xl bg-ink px-6 py-3 font-black text-paper disabled:opacity-60">
        {t("save")}
      </button>
    </form>
  );
}
