import "server-only";
import { withTransaction } from "@/infrastructure/database/transaction";
import type { DietaryPreference, EventType, RsvpStatus } from "@/lib/constants/enums";
import { hashToken } from "@/lib/crypto/tokens";
import { AppError } from "@/lib/errors";
import { mapsUrl, venueLine } from "@/lib/events/format";
import { listEvents as listEventRows } from "@/modules/events/event.repository";
import type { SubmitRsvpInput } from "@/modules/guest-invitations/public-rsvp.schemas";
import { findGuestByTokenHash, setGuestDietary } from "@/modules/guests/guest.repository";
import { listRsvpsForGuest, updateRsvp } from "@/modules/guests/rsvp.repository";
import { findWedding } from "@/modules/weddings/wedding.repository";

// The guest's own RSVP page (API Design §8.10, DB Design §11.2). No account: the personal link is
// the credential. Everything returned is a hand-built whitelist: the guest sees their own name,
// their own events and their own answers, never other guests, private notes, the team or the budget.

export interface PublicRsvpEvent {
  eventId: string;
  name: string;
  type: EventType;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  venue: string | null;
  mapsUrl: string | null;
  dressCode: string | null;
  description: string | null;
  /** "pending" until the guest answers. */
  status: RsvpStatus;
  attendingCount: number;
  note: string | null;
  respondedAt: string | null;
}

export interface PublicRsvp {
  weddingTitle: string;
  /** "Aarav & Diya", from the couple's names, else the wedding's title. */
  coupleNames: string;
  guest: {
    name: string;
    plusOnesAllowed: number;
    dietaryPreference: DietaryPreference | null;
  };
  events: PublicRsvpEvent[];
  /** True once the guest has answered at least one event. */
  hasResponded: boolean;
}

/** One answer for every way a link can be unusable: unknown, revoked, expired, guest or wedding deleted. */
function invalidLink(): AppError {
  return new AppError("INVALID_TOKEN");
}

async function resolveLink(token: string) {
  const guest = await findGuestByTokenHash(hashToken(token));
  if (!guest?.link) throw invalidLink();
  if (guest.link.revokedAt) throw invalidLink();
  if (guest.link.expiresAt && guest.link.expiresAt.getTime() <= Date.now()) throw invalidLink();
  // A deleted wedding hides everything under it, public links included (DB Design §10.3).
  const wedding = await findWedding(guest.weddingId);
  if (!wedding) throw invalidLink();
  return { guest, wedding };
}

async function buildView(
  weddingId: string,
  guest: NonNullable<Awaited<ReturnType<typeof findGuestByTokenHash>>>,
  wedding: NonNullable<Awaited<ReturnType<typeof findWedding>>>,
): Promise<PublicRsvp> {
  const [rsvps, events] = await Promise.all([
    listRsvpsForGuest(weddingId, guest._id),
    listEventRows(weddingId),
  ]);
  const eventById = new Map(events.map((event) => [event._id.toString(), event]));

  const shown: PublicRsvpEvent[] = [];
  for (const rsvp of rsvps) {
    const event = eventById.get(rsvp.eventId.toString());
    if (!event) continue;
    shown.push({
      eventId: event._id.toString(),
      name: event.name,
      type: event.type,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt ? event.endsAt.toISOString() : null,
      timezone: event.timezone,
      venue: venueLine(event.location),
      mapsUrl: mapsUrl(event.location),
      dressCode: event.dressCode ?? null,
      description: event.description ?? null,
      status: rsvp.status,
      attendingCount: rsvp.attendingCount,
      note: rsvp.note ?? null,
      respondedAt: rsvp.respondedAt ? rsvp.respondedAt.toISOString() : null,
    });
  }
  shown.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const names = (wedding.partners ?? []).map((partner) => partner.name.trim()).filter(Boolean);
  return {
    weddingTitle: wedding.title,
    coupleNames: names.length > 0 ? names.join(" & ") : wedding.title,
    guest: {
      name: guest.name,
      plusOnesAllowed: guest.plusOnesAllowed,
      dietaryPreference: guest.dietaryPreference ?? null,
    },
    events: shown,
    hasResponded: shown.some((event) => event.status !== "pending"),
  };
}

export async function getPublicRsvp(token: string): Promise<PublicRsvp> {
  const { guest, wedding } = await resolveLink(token);
  return buildView(guest.weddingId.toString(), guest, wedding);
}

/**
 * The guest answers for one or more of THEIR events. Only status, headcount and note per event, and
 * their own dietary preference, can change. The headcount counts the guest plus whoever they bring
 * and may not exceed 1 plus the plus-ones the couple allowed (a business rule: 422).
 */
export async function submitPublicRsvp(token: string, input: SubmitRsvpInput): Promise<PublicRsvp> {
  const { guest, wedding } = await resolveLink(token);
  const weddingId = guest.weddingId.toString();

  const current = await listRsvpsForGuest(weddingId, guest._id);
  const byEvent = new Map(current.map((rsvp) => [rsvp.eventId.toString(), rsvp]));
  const max = 1 + guest.plusOnesAllowed;

  const changes = input.responses.map((response) => {
    const existing = byEvent.get(response.eventId.toLowerCase());
    // An event the guest isn't invited to looks exactly like one that doesn't exist.
    if (!existing) throw new AppError("NOT_FOUND");
    const comes = response.status === "attending" || response.status === "maybe";
    const count = comes ? (response.attendingCount ?? 1) : 0;
    if (comes && (count < 1 || count > max)) {
      throw new AppError("BUSINESS_RULE_VIOLATION", {
        message:
          guest.plusOnesAllowed === 0
            ? "Your invitation is for one person."
            : `You can bring up to ${guest.plusOnesAllowed} ${guest.plusOnesAllowed === 1 ? "guest" : "guests"}, so the count can be 1 to ${max}.`,
      });
    }
    return {
      eventId: existing.eventId,
      changes: {
        status: response.status,
        attendingCount: count,
        note: response.note === undefined ? (existing.note ?? null) : response.note,
        respondedAt: new Date(),
        respondedVia: "guest_link" as const,
        respondedByUserId: null,
      },
    };
  });

  // All of a guest's answers land together, or none do.
  await withTransaction(async (session) => {
    for (const { eventId, changes: rowChanges } of changes) {
      await updateRsvp(weddingId, guest._id, eventId, rowChanges, session);
    }
    if (input.dietaryPreference) {
      await setGuestDietary(weddingId, guest._id, input.dietaryPreference, session);
    }
  });

  const refreshed = {
    ...guest,
    dietaryPreference: input.dietaryPreference ?? guest.dietaryPreference,
  };
  return buildView(weddingId, refreshed, wedding);
}
