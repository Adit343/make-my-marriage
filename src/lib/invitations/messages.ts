// Wording shared by the server (emails, WhatsApp links it returns) and the browser (the dialog's
// message preview). Pure functions, no secrets: the personal link is passed in.

export type SendKind = "invitation" | "reminder";

/** "Rahul Sharma" -> "Rahul". Falls back to the whole name. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * The pre-filled WhatsApp message (PRD §21): the member reviews it and presses Send themselves.
 * Nothing is sent by this app (no WhatsApp API in V1).
 */
export function whatsappMessage(input: { guestName: string; url: string; kind: SendKind }): string {
  const hello = `Hi ${firstName(input.guestName)},`;
  if (input.kind === "reminder") {
    return [
      hello,
      "A gentle reminder to let us know whether you can join us at our wedding.",
      "Please RSVP here, it only takes a minute:",
      input.url,
      "Thank you!",
    ].join("\n");
  }
  return [
    hello,
    "We would love to invite you to our wedding! ❤️",
    "Please find your digital invitation and event details here:",
    input.url,
    "We would be happy to have you celebrate with us!",
  ].join("\n");
}

/** https://wa.me/<digits>?text=... for an E.164 number such as +919876543210. */
export function whatsappLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
