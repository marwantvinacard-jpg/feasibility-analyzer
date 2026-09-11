"use client";

import { useEffect, useRef } from "react";
import { SessionProvider, useSession } from "@/lib/session";
import { LanguageProvider, useLanguage } from "@/lib/i18n/LanguageContext";

/** Once signed in, the account's saved language preference wins (cross-device
 *  sync); a manual switch while signed in is written back to the profile. */
function LanguageSync() {
  const { user } = useSession();
  const { lang, setLang } = useLanguage();
  const appliedFromAccount = useRef<string | null>(null);

  useEffect(() => {
    if (user?.language && appliedFromAccount.current !== user.uid) {
      appliedFromAccount.current = user.uid;
      if (user.language !== lang) setLang(user.language);
    }
  }, [user, lang, setLang]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <SessionProvider>
        <LanguageSync />
        {children}
      </SessionProvider>
    </LanguageProvider>
  );
}
