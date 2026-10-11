import type { Types } from "mongoose";
import type { GuestSide } from "@/lib/constants/enums";

// Member-facing group shape. `guestCount` is computed from the guests (never stored).
export interface GuestGroupDto {
  id: string;
  name: string;
  side: GuestSide;
  notes: string | null;
  guestCount: number;
  version: number;
  createdAt: string;
}

interface GroupLike {
  _id: Types.ObjectId;
  name: string;
  side: GuestSide;
  notes?: string | null;
  __v?: number;
  createdAt?: Date;
}

export function toGuestGroupDto(group: GroupLike, guestCount: number): GuestGroupDto {
  return {
    id: group._id.toString(),
    name: group.name,
    side: group.side,
    notes: group.notes ?? null,
    guestCount,
    version: group.__v ?? 0,
    createdAt: (group.createdAt ?? new Date(0)).toISOString(),
  };
}
