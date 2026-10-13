// Shown while any dashboard screen is being prepared on the server, so a slow connection sees a
// calm placeholder instead of a frozen page.
export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-3 text-on-surface-variant">
        <span
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
        />
        <span className="font-body-sm text-body-sm">Loading…</span>
      </div>
    </div>
  );
}
