import type { EventType } from "@/lib/constants/enums";

// What the guest screens need to know about the wedding's events: enough to list them as
// invitation choices and to name a reply. Built on the server from the events API.
export interface GuestEventInfo {
  id: string;
  name: string;
  type: EventType;
  startsAt: string;
  timezone: string;
  /** "Poolside Pavilion • Casual": venue and dress code, whichever exist. */
  detail: string | null;
  /** "12 Feb", read in the event's own timezone. */
  dateLabel: string;
}

export interface GuestGroupInfo {
  id: string;
  name: string;
  side: "partnerOne" | "partnerTwo" | "both";
  guestCount: number;
  version: number;
}
