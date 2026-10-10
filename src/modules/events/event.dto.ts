import type { Types } from "mongoose";
import type { EventType } from "@/lib/constants/enums";

// Member-facing event shape (API Design §7.1). `version` is the optimistic-concurrency token sent
// back on PATCH; `canManage` tells the UI whether THIS viewer may edit or delete the event, so the
// screen never has to re-implement the permission rule.
export interface ScheduleItemDto {
  id: string;
  time: string;
  title: string;
  notes: string | null;
  isPublic: boolean;
}

export interface EventDto {
  id: string;
  name: string;
  type: EventType;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  location: unknown;
  description: string | null;
  dressCode: string | null;
  sortOrder: number;
  isPublic: boolean;
  schedule: ScheduleItemDto[];
  createdBy: string;
  canManage: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface EventLike {
  _id: Types.ObjectId;
  name: string;
  type: EventType;
  startsAt: Date;
  endsAt?: Date | null;
  timezone: string;
  location?: unknown;
  description?: string | null;
  dressCode?: string | null;
  sortOrder?: number | null;
  isPublic: boolean;
  schedule?:
    | {
        _id: Types.ObjectId;
        time: string;
        title: string;
        notes?: string | null;
        isPublic: boolean;
      }[]
    | null;
  createdBy: Types.ObjectId;
  __v?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export function toEventDto(event: EventLike, viewer: { canManage: boolean }): EventDto {
  return {
    id: event._id.toString(),
    name: event.name,
    type: event.type,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt ? event.endsAt.toISOString() : null,
    timezone: event.timezone,
    location: event.location ?? null,
    description: event.description ?? null,
    dressCode: event.dressCode ?? null,
    sortOrder: event.sortOrder ?? 0,
    isPublic: event.isPublic,
    schedule: (event.schedule ?? []).map((item) => ({
      id: item._id.toString(),
      time: item.time,
      title: item.title,
      notes: item.notes ?? null,
      isPublic: item.isPublic,
    })),
    createdBy: event.createdBy.toString(),
    canManage: viewer.canManage,
    version: event.__v ?? 0,
    createdAt: (event.createdAt ?? new Date(0)).toISOString(),
    updatedAt: (event.updatedAt ?? new Date(0)).toISOString(),
  };
}
