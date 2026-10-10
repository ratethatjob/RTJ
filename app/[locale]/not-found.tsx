import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-24">
      <h1 className="text-5xl font-black tracking-brand">{t("title")}</h1>
      <p className="text-lg text-slate">{t("body")}</p>
      <Link href="/" className="font-black underline underline-offset-4">
        {t("home")}
      </Link>
    </main>
  );
}
