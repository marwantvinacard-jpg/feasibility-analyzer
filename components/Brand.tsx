import Link from "next/link";
import { cn } from "@/lib/ui";

/** Wordmark: a compass-like mark (feasibility = finding your direction) + name. */
export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 font-semibold", className)}>
      <Mark />
      <span className="text-[1.05rem] tracking-tight">
        Feasibility<span className="text-brand">AI</span>
      </span>
    </Link>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-b from-brand-2 to-brand text-white shadow-glow",
        className
      )}
      aria-hidden
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="m14.5 9.5-2 5-5 2 2-5 5-2Z" fill="currentColor" opacity="0.95" />
      </svg>
    </span>
  );
}
