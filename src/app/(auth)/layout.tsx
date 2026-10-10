export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Login never shares the ops shell — separate route group.
  return children;
}
