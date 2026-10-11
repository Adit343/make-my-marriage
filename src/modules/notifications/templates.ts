import { PASSWORD_RESET_TTL_MINUTES } from "@/lib/constants/auth";

// Transactional email content. Plain inline-styled HTML (email clients ignore stylesheets) in the
// app's emerald/ivory palette, always with a plain-text twin.

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(
  heading: string,
  paragraphs: string[],
  action: { label: string; url: string },
  brand = "Make My Marriage",
) {
  const body = paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#414944">${text}</p>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#FAF6F0;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:20px;color:#1F4D3D">${escapeHtml(brand)}</p>
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;font-weight:normal;color:#1f1b17">${heading}</h1>
    ${body}
    <p style="margin:24px 0">
      <a href="${escapeHtml(action.url)}" style="display:inline-block;background:#1F4D3D;color:#FAF6F0;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px">${action.label}</a>
    </p>
    <p style="margin:0;font-size:12px;line-height:18px;color:#717974">If the button doesn't work, paste this link into your browser:<br>${escapeHtml(action.url)}</p>
  </div>
</body></html>`;
}

export function memberInvitationEmail(input: {
  inviterName: string;
  weddingTitle: string;
  role: "admin" | "member";
  message?: string | null;
  inviteUrl: string;
  validDays: number;
}) {
  const roleText = input.role === "admin" ? "an admin" : "a member";
  const note = input.message?.trim();
  return {
    subject: `${input.inviterName} invited you to plan ${input.weddingTitle}`,
    html: layout(
      "You're invited to help plan a wedding",
      [
        `${escapeHtml(input.inviterName)} invited you to join <strong>${escapeHtml(input.weddingTitle)}</strong> on Make My Marriage as ${roleText}.`,
        ...(note ? [`<em>&ldquo;${escapeHtml(note)}&rdquo;</em>`] : []),
        `Create an account or log in, then accept the invitation. The link works once and expires in ${input.validDays} days.`,
      ],
      { label: "View invitation", url: input.inviteUrl },
    ),
    text: [
      `${input.inviterName} invited you to join "${input.weddingTitle}" on Make My Marriage as ${roleText}.`,
      ...(note ? ["", `"${note}"`] : []),
      "",
      `Create an account or log in, then accept the invitation. The link works once and expires in ${input.validDays} days:`,
      "",
      input.inviteUrl,
    ].join("\n"),
  };
}

export function passwordResetEmail(input: { name: string; resetUrl: string }) {
  const minutes = PASSWORD_RESET_TTL_MINUTES;
  return {
    subject: "Reset your Make My Marriage password",
    html: layout(
      "Reset your password",
      [
        `Hi ${escapeHtml(input.name)},`,
        `We received a request to reset your password. This link works once and expires in ${minutes} minutes.`,
        "If you didn't ask for this, you can ignore this email — your password won't change.",
      ],
      { label: "Set a new password", url: input.resetUrl },
    ),
    text: [
      `Hi ${input.name},`,
      "",
      `We received a request to reset your Make My Marriage password. This link works once and expires in ${minutes} minutes:`,
      "",
      input.resetUrl,
      "",
      "If you didn't ask for this, you can ignore this email — your password won't change.",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------------------------
// Guest emails (Phase 3). The guest sees the couple's names, not the product's, and only their own
// events: nothing about other guests, the team or the budget (DB Design §11.2).
// ---------------------------------------------------------------------------------------------

export interface GuestEmailEvent {
  name: string;
  /** Already formatted in the event's own timezone, e.g. "Sat 13 Feb, 10:00 AM". */
  when: string;
  venue: string | null;
}

function eventLinesHtml(events: GuestEmailEvent[]): string {
  const rows = events
    .map(
      (event) =>
        `<li style="margin:0 0 8px"><strong>${escapeHtml(event.name)}</strong><br><span style="color:#717974">${escapeHtml(event.when)}${event.venue ? ` &middot; ${escapeHtml(event.venue)}` : ""}</span></li>`,
    )
    .join("");
  return `<ul style="margin:0 0 16px;padding-left:18px;font-size:15px;line-height:22px;color:#414944">${rows}</ul>`;
}

function eventLinesText(events: GuestEmailEvent[]): string[] {
  return events.map(
    (event) => `- ${event.name}: ${event.when}${event.venue ? `, ${event.venue}` : ""}`,
  );
}

export function guestInvitationEmail(input: {
  guestName: string;
  weddingTitle: string;
  events: GuestEmailEvent[];
  rsvpUrl: string;
}) {
  const hello = `Hi ${input.guestName.trim().split(/\s+/)[0] ?? input.guestName},`;
  return {
    subject: `You're invited: ${input.weddingTitle}`,
    html: layout(
      "You're invited",
      [
        escapeHtml(hello),
        `We would love to have you celebrate with us at <strong>${escapeHtml(input.weddingTitle)}</strong>.`,
        ...(input.events.length > 0 ? [eventLinesHtml(input.events)] : []),
        "Please let us know if you can make it. This is your personal link: no account or password needed.",
      ],
      { label: "View invitation &amp; RSVP", url: input.rsvpUrl },
      input.weddingTitle,
    ),
    text: [
      hello,
      "",
      `We would love to have you celebrate with us at ${input.weddingTitle}.`,
      "",
      ...eventLinesText(input.events),
      ...(input.events.length > 0 ? [""] : []),
      "Please let us know if you can make it. This is your personal link (no account needed):",
      "",
      input.rsvpUrl,
    ].join("\n"),
  };
}

export function rsvpReminderEmail(input: {
  guestName: string;
  weddingTitle: string;
  events: GuestEmailEvent[];
  rsvpUrl: string;
}) {
  const hello = `Hi ${input.guestName.trim().split(/\s+/)[0] ?? input.guestName},`;
  return {
    subject: `A gentle reminder: please RSVP for ${input.weddingTitle}`,
    html: layout(
      "Will you join us?",
      [
        escapeHtml(hello),
        `We haven't heard from you yet about <strong>${escapeHtml(input.weddingTitle)}</strong>. It only takes a minute to reply.`,
        ...(input.events.length > 0 ? [eventLinesHtml(input.events)] : []),
      ],
      { label: "Reply now", url: input.rsvpUrl },
      input.weddingTitle,
    ),
    text: [
      hello,
      "",
      `We haven't heard from you yet about ${input.weddingTitle}. It only takes a minute to reply:`,
      "",
      ...eventLinesText(input.events),
      ...(input.events.length > 0 ? [""] : []),
      input.rsvpUrl,
    ].join("\n"),
  };
}
