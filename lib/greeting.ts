// Personalized greeting copy — first-time vs returning, time-of-day aware,
// with a warm "how can I help" framing so the dashboard reads like an
// assistant greeting the user by name rather than a generic template.

export function timeOfDay(d = new Date()): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export interface GreetingCopy {
  headline: string;
  subtitle: string;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function dashboardGreeting(
  firstName: string,
  isFirstSession: boolean,
  hasAnalyses: boolean,
  t: Translate
): GreetingCopy {
  if (isFirstSession) {
    return {
      headline: t("greeting.welcome", { name: firstName }),
      subtitle: t("greeting.firstSession"),
    };
  }
  const tod = timeOfDay();
  const greet = t(`greeting.${tod}`);
  if (!hasAnalyses) {
    return {
      headline: t("greeting.returning", { greet, name: firstName }),
      subtitle: t("greeting.noAnalysesYet"),
    };
  }
  return {
    headline: t("greeting.welcomeBack", { name: firstName }),
    subtitle: t("greeting.hasAnalyses", { greet }),
  };
}
