import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown for an unknown address instead of silently redirecting to Home (the old catch-all hid mistyped links). */
export function NotFoundPage({ inCase = false }: { inCase?: boolean }) {
  const { pathname } = useLocation();
  return (
    <div className="flex flex-1 items-center justify-center p-6" data-testid="not-found">
      <div className="max-w-md text-center">
        <Compass className="mx-auto h-8 w-8 text-text-muted" aria-hidden="true" />
        {inCase ? <h2 className="mt-2 text-lg font-semibold text-text-primary">This case has no such page</h2>
                : <h1 className="mt-2 text-lg font-semibold text-text-primary">Page not found</h1>}
        <p className="mt-1 text-sm text-text-secondary break-all">Nothing exists at <span className="font-mono">{pathname}</span>.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button asChild variant="primary" size="sm"><Link to="/command-center">Go to Home</Link></Button>
          <Button asChild variant="secondary" size="sm"><Link to="/cases">Open Cases</Link></Button>
        </div>
      </div>
    </div>
  );
}
