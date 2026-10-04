import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { getServerSession } from "@/modules/auth/server-session";
import { getMyWedding } from "@/modules/weddings/wedding.service";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = { title: "Dashboard — Make My Marriage" };

// Minimal signed-in landing page so the auth flows have somewhere to arrive. Step 1.8 replaces it
// with the Stitch "Member Wedding Dashboard" design.
export default async function DashboardPage() {
  const auth = await getServerSession();
  if (!auth) redirect("/login");
  const mine = await getMyWedding(auth);

  return (
    <div className="min-h-screen bg-background text-body-md">
      <header className="border-b border-on-surface/5 bg-surface/90">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-6">
          <span className="font-headline-sm text-headline-sm font-medium tracking-tight text-primary">
            Make My Marriage
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <span className="mb-2 block font-label-md text-label-md tracking-widest text-secondary uppercase">
          Signed in as {auth.user.name}
        </span>
        {mine ? (
          <>
            <h1 className="mb-3 font-headline-lg text-headline-lg text-on-surface">
              {mine.wedding.title}
            </h1>
            <p className="text-on-surface-variant">
              You are the <strong className="font-semibold text-on-surface">{mine.role}</strong> of
              this wedding workspace.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-3 font-headline-lg text-headline-lg text-on-surface">
              No wedding workspace yet
            </h1>
            <p className="text-on-surface-variant">
              Create a wedding, or open an invitation link from your family to join theirs.
            </p>
          </>
        )}

        <div className="custom-subtle-shadow mt-10 flex items-start gap-3 rounded-xl border border-on-surface/10 bg-surface-container-lowest p-6">
          <Icon name="info" className="mt-0.5 text-[20px] text-primary" />
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            This is a temporary page. The full wedding dashboard is built in Phase 1, step 1.8.
          </p>
        </div>
      </main>
    </div>
  );
}
