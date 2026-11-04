import { Link, useRouteError } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * App-wide error page for exceptions during rendering. Replaces React Router's default screen, which printed the
 * error message and a JavaScript stack trace to the officer. Details go to the browser console only.
 */
export function RouteErrorPage() {
  const err = useRouteError();
  console.error("Unhandled page error", err);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6" data-testid="route-error">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-critical-red" aria-hidden="true" />
        <h1 className="mt-2 text-lg font-semibold text-text-primary">This page could not be shown</h1>
        <p className="mt-1 text-sm text-text-secondary">Something went wrong while displaying it. No data was changed. Try again, or go back to Home.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="primary" size="sm" onClick={() => window.location.reload()}>Try again</Button>
          <Button asChild variant="secondary" size="sm"><Link to="/command-center">Go to Home</Link></Button>
        </div>
      </div>
    </div>
  );
}
