import Link from "next/link";
import { cn, toneSoft, type Tone } from "@/lib/ui";

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-6", className)}>{children}</div>;
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("card p-5 sm:p-6", className)}>{children}</div>;
}

export function Badge({
  children,
  tone,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone ? toneSoft[tone] : "border-border bg-surface-2 text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Small uppercase kicker, gold-tinted for the editorial feel. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
      <span className="h-px w-6 bg-brand/50" />
      {children}
    </span>
  );
}

type BtnProps = {
  href?: string;
  variant?: "primary" | "ghost";
  className?: string;
  children: React.ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  "aria-label"?: string;
};

export function Button({ href, variant = "primary", className, children, ...rest }: BtnProps) {
  const cls = cn("btn", variant === "primary" ? "btn-primary" : "btn-ghost", className);
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={rest["aria-label"]}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
