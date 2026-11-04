import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ChevronRight, Inbox, Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shared page building blocks, so every page has the same header, spacing and loading/empty/error/denied states. */

export interface Crumb { label: string; to?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-text-secondary">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="h-3 w-3 text-text-muted shrink-0" aria-hidden="true" />}
            {c.to ? (
              <Link to={c.to} className="hover:text-electric-blue hover:underline truncate">{c.label}</Link>
            ) : (
              <span aria-current="page" className="text-text-primary font-medium truncate">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, description, crumbs, actions, className }: {
  title: ReactNode; description?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode; className?: string;
}) {
  return (
    <header className={cn("border-b border-border-subtle bg-surface-1 px-4 sm:px-6 py-4", className)}>
      <div className="mx-auto w-full max-w-6xl flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {crumbs && <Breadcrumbs items={crumbs} />}
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">{title}</h1>
          {description && <p className="text-sm text-text-secondary max-w-3xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

/** Scrollable content column under a PageHeader. */
export function PageBody({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={cn("mx-auto w-full px-4 sm:px-6 py-5 space-y-5", wide ? "max-w-7xl" : "max-w-6xl", className)}>{children}</div>
    </div>
  );
}

export function Section({ title, description, actions, children, className, id }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string;
}) {
  return (
    <section id={id} aria-labelledby={id && title ? `${id}-title` : undefined} className={cn("rounded-lg border border-border-subtle bg-surface-1", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border-subtle px-4 py-3">
          <div className="min-w-0">
            {title && <h2 id={id ? `${id}-title` : undefined} className="text-[15px] font-semibold text-text-primary">{title}</h2>}
            {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Label/value pairs, e.g. case facts. */
export function FactList({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 | 4 }) {
  const cols = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3", cols)}>
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium text-text-secondary">{label}</dt>
          <dd className="text-sm text-text-primary mt-0.5 break-words">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LoadingState({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">{label}</span>
      <p className="text-sm text-text-secondary" aria-hidden="true">{label}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-md bg-surface-2 motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action, icon: Icon = Inbox }: {
  title: string; children?: ReactNode; action?: ReactNode; icon?: typeof Inbox;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-surface-1 px-6 py-10 text-center">
      <Icon className="mx-auto h-7 w-7 text-text-muted" aria-hidden="true" />
      <h3 className="mt-2 text-sm font-semibold text-text-primary">{title}</h3>
      {children && <div className="mt-1 text-sm text-text-secondary max-w-md mx-auto">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Could not load this information", message, trace, onRetry }: {
  title?: string; message?: string; trace?: string; onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-critical-red/40 bg-critical-red/5 px-5 py-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-critical-red shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          {message && <p className="text-sm text-text-secondary break-words">{message}</p>}
          {trace && <p className="text-xs text-text-secondary">Trace ID: <span className="font-mono">{trace}</span></p>}
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2 gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Access denied by the server. Shows the server's reason; never any data from a previous view. */
export function DeniedState({ message, backTo = "/cases", backLabel = "Back to cases" }: { message?: string; backTo?: string; backLabel?: string }) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-lg border border-border-strong bg-surface-1 px-6 py-8 text-center" data-testid="access-denied">
      <Lock className="mx-auto h-7 w-7 text-text-secondary" aria-hidden="true" />
      <h2 className="mt-2 text-base font-semibold text-text-primary">You do not have access to this</h2>
      <p className="mt-1 text-sm text-text-secondary">
        {(() => { const m = (message || "The server refused the request.").trim(); return /[.!?]$/.test(m) ? m : `${m}.`; })()} Access is granted by case assignment and jurisdiction; the attempt was recorded in the audit log.
      </p>
      <Button asChild variant="secondary" size="sm" className="mt-4">
        <Link to={backTo}>{backLabel}</Link>
      </Button>
    </div>
  );
}

/** Body of one case tab: an H2 title row (the case title is the page H1) and a scrollable content column. */
export function CaseTabBody({ title, description, actions, children, wide }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; wide?: boolean;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={cn("mx-auto w-full px-4 sm:px-6 py-5 space-y-4", wide ? "max-w-7xl" : "max-w-6xl")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            {description && <p className="text-sm text-text-secondary mt-0.5 max-w-3xl">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Previous/next paging for server-paged lists. Shows the range and the server's total. */
export function Pager({ offset, limit, total, onChange, label = "items" }: {
  offset: number; limit: number; total: number; onChange: (offset: number) => void; label?: string;
}) {
  if (total <= limit && offset === 0) return null;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="pager">
      <span className="text-text-secondary" aria-live="polite">{from}–{to} of {total} {label}</span>
      <span className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>Previous</Button>
        <Button variant="secondary" size="sm" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>Next</Button>
      </span>
    </nav>
  );
}
