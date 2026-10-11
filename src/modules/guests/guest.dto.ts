import type { Types } from "mongoose";
import type {
  AgeCategory,
  DietaryPreference,
  EventType,
  GuestInviteStatus,
  GuestSide,
  InviteChannel,
  RespondedVia,
  RsvpStatus,
} from "@/lib/constants/enums";
import type { AddressInput } from "@/lib/validation/location";

// Member-facing guest shapes (API Design §8.2 to §8.5). The list shape is deliberately thinner than
// the detail shape: no private `notes`, no postal address. `version` is the optimistic-concurrency
// token sent back on PATCH. Nothing here carries a token or hash.

export interface RsvpDto {
  eventId: string;
  status: RsvpStatus;
  /** Everyone coming, the guest included; 0 unless attending or maybe. */
  attendingCount: number;
  note: string | null;
  respondedAt: string | null;
  respondedVia: RespondedVia | null;
}

/** What the list needs from an RSVP row to show the reply column. */
export type RsvpRefDto = Pick<RsvpDto, "eventId" | "status" | "attendingCount">;

export interface GuestInvitationDto {
  status: GuestInviteStatus;
  lastChannel: InviteChannel | null;
  lastSentAt: string | null;
  sendCount: number;
}

export interface GuestListItemDto {
  id: string;
  name: string;
  groupId: string | null;
  side: GuestSide;
  relationLabel: string | null;
  email: string | null;
  phone: string | null;
  ageCategory: AgeCategory;
  plusOnesAllowed: number;
  dietaryPreference: DietaryPreference | null;
  invitation: GuestInvitationDto;
  rsvps: RsvpRefDto[];
  rsvpSummary: { invitedToCount: number; respondedCount: number };
  version: number;
}

export interface GuestEventResponseDto extends RsvpDto {
  eventName: string;
  eventType: EventType;
  startsAt: string;
  timezone: string;
}

export interface GuestDetailDto extends Omit<GuestListItemDto, "rsvps"> {
  address: AddressInput | null;
  notes: string | null;
  responses: GuestEventResponseDto[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface InvitationLike {
  status?: GuestInviteStatus;
  lastChannel?: InviteChannel | null;
  lastSentAt?: Date | null;
  sendCount?: number;
}

interface GuestLike {
  _id: Types.ObjectId;
  name: string;
  groupId?: Types.ObjectId | null;
  side: GuestSide;
  relationLabel?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: Record<string, string | null | undefined> | null;
  ageCategory: AgeCategory;
  plusOnesAllowed: number;
  dietaryPreference?: DietaryPreference | null;
  notes?: string | null;
  invitation?: InvitationLike | null;
  createdBy: Types.ObjectId;
  __v?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RsvpLike {
  guestId: Types.ObjectId;
  eventId: Types.ObjectId;
  status: RsvpStatus;
  attendingCount: number;
  note?: string | null;
  respondedAt?: Date | null;
  respondedVia?: RespondedVia | null;
}

export function toRsvpDto(rsvp: RsvpLike): RsvpDto {
  return {
    eventId: rsvp.eventId.toString(),
    status: rsvp.status,
    attendingCount: rsvp.attendingCount,
    note: rsvp.note ?? null,
    respondedAt: rsvp.respondedAt ? rsvp.respondedAt.toISOString() : null,
    respondedVia: rsvp.respondedVia ?? null,
  };
}

function toInvitationDto(invitation: InvitationLike | null | undefined): GuestInvitationDto {
  return {
    status: invitation?.status ?? "not_invited",
    lastChannel: invitation?.lastChannel ?? null,
    lastSentAt: invitation?.lastSentAt ? invitation.lastSentAt.toISOString() : null,
    sendCount: invitation?.sendCount ?? 0,
  };
}

function base(guest: GuestLike) {
  return {
    id: guest._id.toString(),
    name: guest.name,
    groupId: guest.groupId ? guest.groupId.toString() : null,
    side: guest.side,
    relationLabel: guest.relationLabel ?? null,
    email: guest.email ?? null,
    phone: guest.phone ?? null,
    ageCategory: guest.ageCategory,
    plusOnesAllowed: guest.plusOnesAllowed,
    dietaryPreference: guest.dietaryPreference ?? null,
    invitation: toInvitationDto(guest.invitation),
    version: guest.__v ?? 0,
  };
}

export function toGuestListItemDto(guest: GuestLike, rsvps: RsvpLike[]): GuestListItemDto {
  return {
    ...base(guest),
    rsvps: rsvps.map((rsvp) => ({
      eventId: rsvp.eventId.toString(),
      status: rsvp.status,
      attendingCount: rsvp.attendingCount,
    })),
    rsvpSummary: {
      invitedToCount: rsvps.length,
      respondedCount: rsvps.filter((rsvp) => rsvp.status !== "pending").length,
    },
  };
}

export function toGuestDetailDto(
  guest: GuestLike,
  responses: GuestEventResponseDto[],
): GuestDetailDto {
  const address = guest.address ? stripEmpty(guest.address) : null;
  return {
    ...base(guest),
    address,
    notes: guest.notes ?? null,
    responses,
    rsvpSummary: {
      invitedToCount: responses.length,
      respondedCount: responses.filter((response) => response.status !== "pending").length,
    },
    createdBy: guest.createdBy.toString(),
    createdAt: (guest.createdAt ?? new Date(0)).toISOString(),
    updatedAt: (guest.updatedAt ?? new Date(0)).toISOString(),
  };
}

/** A stored address is a plain object; keep only the fields that have a value. */
function stripEmpty(address: Record<string, string | null | undefined>): AddressInput | null {
  const kept = Object.fromEntries(
    Object.entries(address).filter(([, value]) => typeof value === "string" && value !== ""),
  ) as AddressInput;
  return Object.keys(kept).length > 0 ? kept : null;
}
