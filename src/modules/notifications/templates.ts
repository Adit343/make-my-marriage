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

function layout(heading: string, paragraphs: string[], action: { label: string; url: string }) {
  const body = paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#414944">${text}</p>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#FAF6F0;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:20px;color:#1F4D3D">Make My Marriage</p>
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
