import Link from "next/link";
import { cn } from "@/lib/ui";
import { Icon } from "@/components/icons";

/** Wordmark: a compass mark (feasibility = finding your direction) + serif-tinged name. */
export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      <Mark />
      <span className="text-[1.1rem] font-semibold tracking-tightest">
        Feasibility<span className="font-display italic text-brand">AI</span>
      </span>
    </Link>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg bg-brand text-white shadow-[0_6px_16px_-8px_rgb(var(--brand)/0.9)]",
        className
      )}
      aria-hidden
    >
      <Icon name="compass" size={18} strokeWidth={1.75} />
    </span>
  );
}
