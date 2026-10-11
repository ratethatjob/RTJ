"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createMemberInvite,
  removeMember,
  revokeMemberInvite,
  updateMember,
} from "@/app/[locale]/business/team/actions";
import { CopyLink } from "./copy-link";

const ROLES = ["owner", "hr", "location_manager"] as const;
type Role = (typeof ROLES)[number];

type Location = { id: string; name: string; address: string };
type Member = { id: string; userId: string; role: Role; locationIds: string[]; email: string | null };
type Invite = { id: string; role: Role; locationIds: string[]; url: string; expiresAt: string };

type Props = {
  orgId: string;
  meId: string;
  isOwner: boolean;
  members: Member[];
  invites: Invite[];
  locations: Location[];
  joinBase: string;
};

export function TeamManager({ orgId, meId, isOwner, members, invites, locations, joinBase }: Props) {
  const t = useTranslations("Team");
  const tb = useTranslations("Business");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);

  function run(action: () => Promise<{ ok?: true; token?: string; error?: string }>, after?: (token?: string) => void) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        return setMessage(
          result.error === "lastOwner" ? t("lastOwner") : result.error === "invalid" ? t("pickLocation") : t("error"),
        );
      }
      after?.(result.token);
      router.refresh();
    });
  }

  const placeNames = (ids: string[]) =>
    ids.length === 0
      ? t("allLocations")
      : locations
          .filter((l) => ids.includes(l.id))
          .map((l) => l.address)
          .join(", ");

  return (
    <div className="flex flex-col gap-6">
      {message && <p className="rounded-2xl bg-white p-4 font-black">{message}</p>}

      <section className="rounded-3xl bg-white p-6">
        <h2 className="text-2xl font-black tracking-brand">{t("members")}</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {members.map((m) =>
            isOwner && m.userId !== meId ? (
              <li key={m.id} className="rounded-2xl bg-paper p-4">
                <p className="break-all font-black">{m.email}</p>
                <RoleEditor
                  locations={locations}
                  initialRole={m.role}
                  initialIds={m.locationIds}
                  submitLabel={t("save")}
                  disabled={pending} aria-busy={pending}
                  onSubmit={(role, ids) => run(() => updateMember(orgId, m.id, role, ids))}
                  extra={
                    <button
                      type="button"
                      disabled={pending} aria-busy={pending}
                      onClick={() => run(() => removeMember(orgId, m.id))}
                      className="rounded-xl px-4 py-2 font-black underline underline-offset-4"
                    >
                      {t("remove")}
                    </button>
                  }
                />
              </li>
            ) : (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-paper p-4">
                <span className="min-w-0">
                  <span className="block break-all font-black">
                    {m.email}
                    {m.userId === meId && <span className="font-medium text-slate"> · {t("you")}</span>}
                  </span>
                  <span className="text-slate">
                    {m.role === "location_manager" ? placeNames(m.locationIds) : t("allLocations")}
                  </span>
                </span>
                <span className="rounded-lg border border-mist px-2.5 py-1 text-sm font-black">
                  {tb(`roles.${m.role}`)}
                </span>
              </li>
            ),
          )}
        </ul>
      </section>

      {isOwner && (
        <>
          <section className="rounded-3xl bg-white p-6">
            <h2 className="text-2xl font-black tracking-brand">{t("invite")}</h2>
            <RoleEditor
              locations={locations}
              initialRole="hr"
              initialIds={[]}
              submitLabel={t("createLink")}
              disabled={pending} aria-busy={pending}
              onSubmit={(role, ids) =>
                run(
                  () => createMemberInvite(orgId, role, ids),
                  (token) => token && setNewLink(`${joinBase}/${token}`),
                )
              }
            />
            {newLink && (
              <div className="mt-4 rounded-2xl bg-paper p-4">
                <p className="mb-3 text-slate">{t("linkHint")}</p>
                <CopyLink url={newLink} />
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-6">
            <h2 className="text-2xl font-black tracking-brand">{t("pending")}</h2>
            {invites.length === 0 ? (
              <p className="mt-3 text-slate">{t("noPending")}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {invites.map((i) => (
                  <li key={i.id} className="rounded-2xl bg-paper p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="font-black">{tb(`roles.${i.role}`)}</span>
                        <span className="text-slate">
                          {" "}
                          · {i.role === "location_manager" ? placeNames(i.locationIds) : t("allLocations")} ·{" "}
                          {t("expires", { date: format.dateTime(new Date(i.expiresAt), { dateStyle: "medium" }) })}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={pending} aria-busy={pending}
                        onClick={() => run(() => revokeMemberInvite(i.id))}
                        className="font-black underline underline-offset-4"
                      >
                        {t("revoke")}
                      </button>
                    </div>
                    <CopyLink url={i.url} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function RoleEditor({
  locations,
  initialRole,
  initialIds,
  submitLabel,
  disabled,
  onSubmit,
  extra,
}: {
  locations: Location[];
  initialRole: Role;
  initialIds: string[];
  submitLabel: string;
  disabled: boolean;
  onSubmit: (role: Role, ids: string[]) => void;
  extra?: React.ReactNode;
}) {
  const t = useTranslations("Team");
  const tb = useTranslations("Business");
  const [role, setRole] = useState<Role>(initialRole);
  const [ids, setIds] = useState<string[]>(initialIds);

  return (
    <div className="mt-3 flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-black text-slate">{t("role")}</legend>
        {ROLES.map((r) => (
          <label key={r} className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3">
            <input
              type="radio"
              checked={role === r}
              onChange={() => setRole(r)}
              className="mt-1 size-4 accent-ink"
            />
            <span>
              <span className="block font-black">{tb(`roles.${r}`)}</span>
              <span className="text-slate">{tb(`roleDescriptions.${r}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {role === "location_manager" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-black text-slate">{t("locations")}</legend>
          {locations.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3">
              <input
                type="checkbox"
                checked={ids.includes(l.id)}
                onChange={(e) => setIds(e.target.checked ? [...ids, l.id] : ids.filter((x) => x !== l.id))}
                className="size-4 accent-ink"
              />
              <span>
                <span className="font-black">{l.name}</span> <span className="text-slate">{l.address}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSubmit(role, ids)}
          className="rounded-2xl bg-ink px-5 py-3 font-black text-paper disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {extra}
      </div>
    </div>
  );
}
