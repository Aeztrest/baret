import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Join class names and let a later Tailwind utility win over an earlier one
 * in the same group. Without the merge step a caller cannot override padding
 * or colour on a component that already sets it.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
