import Link from "next/link";
import { Logo } from "@/components/Brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-paper-glow min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card animate-fade-up p-7 shadow-lift">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-faint hover:text-muted">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
