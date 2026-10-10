"use client";

// Shown by the route-level error boundaries (app/error.tsx, app/app/error.tsx).
// Without them, any crash while rendering a page fell through to the root
// global-error screen, replacing the ENTIRE app with a static message and no
// way back except a manual reload.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useT } from "@/lib/i18n/LanguageContext";

export function ErrorScreen({ error, reset, homeHref }: { error: Error & { digest?: string }; reset: () => void; homeHref: string }) {
  const t = useT();
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-stop/12 text-stop">
        <Icon name="x" size={26} strokeWidth={2} />
      </span>
      <h2 className="font-display mt-4 text-lg font-semibold">{t("errors.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("errors.body")}</p>
      {error.digest && <p className="mt-2 text-xs text-faint">{t("errors.reference", { id: error.digest })}</p>}
      <div className="mt-5 flex justify-center gap-2">
        <Button variant="ghost" href={homeHref}>{t("errors.home")}</Button>
        <Button onClick={() => reset()}>{t("errors.retry")}</Button>
      </div>
    </div>
  );
}
