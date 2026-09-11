import Link from "next/link";
import { Logo } from "@/components/Brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper-glow px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card p-6 sm:p-7">
          <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <p className="mt-5 text-center text-sm text-muted">{footer}</p>}
        <p className="mt-6 text-center">
          <Link href="/" className="text-xs text-faint hover:text-muted">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
