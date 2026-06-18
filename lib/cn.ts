type ClassValue = string | number | false | null | undefined;

/** Tiny classnames joiner; avoids a dependency for the prototype. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
