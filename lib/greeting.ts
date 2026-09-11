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

export function dashboardGreeting(firstName: string, isFirstSession: boolean, hasAnalyses: boolean): GreetingCopy {
  if (isFirstSession) {
    return {
      headline: `Welcome, ${firstName}`,
      subtitle: "I'm ready when you are — describe a business idea and I'll run the full feasibility study.",
    };
  }
  const tod = timeOfDay();
  const greet = tod === "morning" ? "Good morning" : tod === "afternoon" ? "Good afternoon" : "Good evening";
  if (!hasAnalyses) {
    return {
      headline: `${greet}, ${firstName}`,
      subtitle: "Welcome back — how can I help? Run your first analysis whenever you're ready.",
    };
  }
  return {
    headline: `Welcome back, ${firstName}`,
    subtitle: `${greet}! Start a new analysis, or pick up a report you've already run.`,
  };
}
