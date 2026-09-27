import { Mark } from "@/components/Brand";
import { Button } from "@/components/kit";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
      <Mark className="mb-5" />
      <h1 className="font-display text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        The page you're looking for doesn't exist, or you may not have access to it.
      </p>
      <div className="mt-6 flex gap-3">
        <Button href="/">Go home</Button>
        <Button href="/app" variant="ghost">
          Go to dashboard <Icon name="arrow" size={16} />
        </Button>
      </div>
    </div>
  );
}
