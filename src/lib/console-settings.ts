/** Always confirm cancel / refund before money-moving actions. */
export function confirmDestructive(message: string): boolean {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}
