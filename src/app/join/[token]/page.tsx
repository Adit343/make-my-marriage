import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { parseInviteToken } from "@/lib/invite-link";
import { getServerSession } from "@/modules/auth/server-session";
import { findActiveMembershipByUser } from "@/modules/members/member.repository";
import { previewInvitation } from "@/modules/members/invitation.service";
import { AcceptInvitation } from "./accept-invitation";

export const metadata: Metadata = {
  title: "Join a wedding — Make My Marriage",
  // The URL is a secret: keep it out of referrers and search indexes.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const BUTTON =
  "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-title text-[14px] font-semibold transition-all duration-150 focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-hidden";
const PRIMARY = `${BUTTON} bg-primary-container text-surface-bright shadow-xs hover:-translate-y-0.5 hover:bg-tertiary-container`;
const SECONDARY = `${BUTTON} border border-outline-variant/60 bg-surface-container-lowest text-on-surface shadow-xs hover:bg-surface-container-low`;

function Shell({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-primary-container px-4 py-10 text-body-md selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      <div className="w-full max-w-[440px]">
        <p className="mb-6 text-center font-headline-sm text-headline-sm font-medium tracking-tight text-surface-bright">
          Make My Marriage
        </p>
        <div className="rounded-2xl bg-surface p-8 shadow-sm">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
            <Icon name={icon} className="text-[22px]" />
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

// Reached from the link in an invitation email. Not designed in Stitch yet: built in the auth
// screens' visual language until a design exists.
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const token = parseInviteToken((await params).token);
  const preview = token ? await previewInvitation(token) : { valid: false as const };

  if (!token || !preview.valid) {
    return (
      <Shell icon="error">
        <h1 className="mb-2 font-headline-md text-headline-md font-normal tracking-tight text-on-surface">
          This invitation isn&apos;t valid
        </h1>
        <p className="mb-6 font-body-sm text-body-sm text-on-surface-variant">
          The link may have expired, already been used, or been withdrawn. Ask the person who
          invited you to send a new one.
        </p>
        <Link href="/login" className={SECONDARY}>
          Go to log in
        </Link>
      </Shell>
    );
  }

  const session = await getServerSession();
  const roleText = preview.role === "admin" ? "an admin" : "a member";
  const summary = (
    <>
      <h1 className="mb-2 font-headline-md text-headline-md font-normal tracking-tight text-on-surface">
        Join {preview.weddingTitle}
      </h1>
      <p className="mb-6 font-body-sm text-body-sm text-on-surface-variant">
        <strong className="font-semibold text-on-surface">{preview.inviterName}</strong> invited you
        to help plan this wedding as {roleText}.
      </p>
    </>
  );

  if (!session) {
    return (
      <Shell icon="group_add">
        {summary}
        <div className="space-y-3">
          <Link href={`/signup?invite=${token}`} className={PRIMARY}>
            Create an account
          </Link>
          <Link href={`/login?invite=${token}`} className={SECONDARY}>
            I already have an account
          </Link>
        </div>
      </Shell>
    );
  }

  if (await findActiveMembershipByUser(session.userId)) {
    return (
      <Shell icon="error">
        <h1 className="mb-2 font-headline-md text-headline-md font-normal tracking-tight text-on-surface">
          You already belong to a wedding
        </h1>
        <p className="mb-6 font-body-sm text-body-sm text-on-surface-variant">
          Each account can be part of one wedding. To join {preview.weddingTitle}, leave your
          current wedding first, or use a different account.
        </p>
        <Link href="/dashboard" className={PRIMARY}>
          Back to my dashboard
        </Link>
      </Shell>
    );
  }

  return (
    <Shell icon="group_add">
      {summary}
      <AcceptInvitation token={token} email={session.user.email} />
    </Shell>
  );
}
