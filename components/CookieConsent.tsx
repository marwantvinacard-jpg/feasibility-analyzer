"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/kit";
import { analyticsConfigured, getAnalyticsConsent, setAnalyticsConsent } from "@/lib/consent";
import { useT } from "@/lib/i18n/LanguageContext";

/** Asks once for analytics cookies; nothing optional runs until "Accept". */
export function CookieConsent() {
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(analyticsConfigured() && getAnalyticsConsent() === null);
  }, []);
  if (!open) return null;

  const choose = (v: "granted" | "denied") => {
    setAnalyticsConsent(v);
    setOpen(false);
  };
  return (
    <div role="dialog" aria-live="polite" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-border bg-surface p-4 shadow-lg">
      <p className="text-sm text-muted">
        {t("consent.body")}{" "}
        <Link href="/privacy" className="text-brand underline">{t("consent.learnMore")}</Link>
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" className="text-sm" onClick={() => choose("denied")}>{t("consent.decline")}</Button>
        <Button className="text-sm" onClick={() => choose("granted")}>{t("consent.accept")}</Button>
      </div>
    </div>
  );
}
