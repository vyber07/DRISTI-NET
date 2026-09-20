import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges conditional class names and resolves Tailwind class conflicts.
 * Standard shadcn/ui convention — used by every component in components/ui.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
