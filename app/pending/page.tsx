"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { useT } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function PendingPage() {
  const { user, ready, logout } = useSession();
  const t = useT();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.status === "approved") router.replace("/app");
  }, [ready, user, router]);

  if (!ready || !user || user.status === "approved") return null;
  const rejected = user.status === "rejected";

  return (
    <AuthShell
      title={rejected ? t("auth.rejectedTitle") : t("auth.almostTitle")}
      subtitle={rejected ? t("auth.rejectedBody", { name: user.name }) : t("auth.almostBody", { name: user.name })}
      topRight={<LanguageSwitcher />}
    >
      <div className="flex flex-col items-center py-4 text-center">
        <span className={`grid h-14 w-14 place-items-center rounded-2xl ${rejected ? "bg-stop/12 text-stop" : "bg-warn/12 text-warn"}`}>
          <Icon name={rejected ? "x" : "clock"} size={26} />
        </span>
        <p className="mt-4 text-sm text-muted">
          {rejected ? t("auth.rejectedNote") : t("auth.pendingNote", { email: user.email })}
        </p>
        <button onClick={() => logout()} className="mt-6 text-sm text-faint hover:text-ink">{t("auth.signOut")}</button>
      </div>
    </AuthShell>
  );
}
