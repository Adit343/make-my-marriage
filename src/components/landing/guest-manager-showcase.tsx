"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

// Interactive guest-list preview on the landing page (sample data, not real guests).

const FILTERS = [
  "All (512)",
  "Mehendi Confirmed (340)",
  "Haldi Ceremony (220)",
  "Pheras & Reception (490)",
];

const GUESTS: {
  name: string;
  affiliation: string;
  contact: string;
  events: string;
  rsvp: string;
  rsvpTone: "confirmed" | "awaiting" | "mixed";
  action: { label: string; icon: IconName; muted?: boolean };
}[] = [
  {
    name: "Dr. Harshvardhan Singhania (+3)",
    affiliation: "Groom’s Family (VIP)",
    contact: "+91 98201 44210",
    events: "All 4 Events",
    rsvp: "Confirmed (4 pax)",
    rsvpTone: "confirmed",
    action: { label: "Send WhatsApp Invite", icon: "send" },
  },
  {
    name: "Ananya Sen & Kabir Roy (+1)",
    affiliation: "Bride’s Cousins",
    contact: "+91 99100 87312",
    events: "Sangeet, Haldi, Reception",
    rsvp: "Confirmed (2 pax)",
    rsvpTone: "confirmed",
    action: { label: "Copy Portal Link", icon: "link", muted: true },
  },
  {
    name: "Vikramaditya & Sunita Oberoi (+2)",
    affiliation: "Father’s Business Assocs",
    contact: "+91 98112 55901",
    events: "Reception Only",
    rsvp: "Awaiting Response",
    rsvpTone: "awaiting",
    action: { label: "Resend Reminder", icon: "mark_chat_unread" },
  },
  {
    name: "IIT Bombay Alumni Batch (+12)",
    affiliation: "College Friends",
    contact: "Broadcast Cohort",
    events: "Sangeet & Reception",
    rsvp: "10 Confirmed, 2 Declined",
    rsvpTone: "mixed",
    action: { label: "View Group List", icon: "group" },
  },
];

const RSVP_TONE = {
  confirmed: "bg-primary-fixed text-on-primary-fixed",
  awaiting: "bg-secondary-fixed text-on-secondary-fixed",
  mixed: "bg-surface-container text-on-surface",
};

export function GuestManagerShowcase() {
  const toast = useToast();
  const [active, setActive] = useState(FILTERS[0]);

  function selectFilter(filter: string) {
    setActive(filter);
    toast({ type: "info", message: `Filtered guest list view to: ${filter}` });
  }

  return (
    <div className="custom-elevation-elevated rounded-xl border border-on-surface/10 bg-surface-container-lowest p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-on-surface/10 pb-6">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={active === filter}
            onClick={() => selectFilter(filter)}
            className={`rounded-full px-3.5 py-1.5 font-label-sm text-label-sm transition-colors ${
              active === filter
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface hover:bg-surface-container-high"
            }`}
          >
            {filter}
          </button>
        ))}
        <button
          type="button"
          onClick={() => selectFilter("Dietary: Jain / Strict Veg (114)")}
          className="flex items-center gap-1 rounded-full bg-secondary-fixed/50 px-3.5 py-1.5 font-label-sm text-label-sm text-on-secondary-fixed"
        >
          <Icon name="restaurant" className="text-[14px]" />
          <span>Dietary: Jain / Strict Veg (114)</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-on-surface/10">
        <table className="w-full text-left font-body-sm text-body-sm">
          <thead className="bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
            <tr>
              <th className="px-4 py-3">Primary Guest</th>
              <th className="px-4 py-3">Affiliation</th>
              <th className="px-4 py-3">WhatsApp Contact</th>
              <th className="px-4 py-3">Events Included</th>
              <th className="px-4 py-3">RSVP Status</th>
              <th className="px-4 py-3 text-right">Quick Dispatch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-on-surface/10 bg-surface-container-lowest">
            {GUESTS.map((guest) => (
              <tr key={guest.name}>
                <td className="px-4 py-3 font-medium text-on-surface">{guest.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-surface-container px-2 py-0.5 text-label-sm text-on-surface">
                    {guest.affiliation}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-label-sm text-on-surface-variant">
                  {guest.contact}
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{guest.events}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2.5 py-1 font-label-sm text-label-sm ${RSVP_TONE[guest.rsvpTone]}`}
                  >
                    {guest.rsvp}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      toast({
                        type: "success",
                        message: "Dispatched invite / reminder via WhatsApp Gateway",
                      })
                    }
                    className={`inline-flex items-center gap-1 font-label-sm ${
                      guest.action.muted
                        ? "text-on-surface-variant hover:text-primary"
                        : "text-primary hover:text-primary-container"
                    }`}
                  >
                    <Icon name={guest.action.icon} className="text-[16px]" />
                    <span>{guest.action.label}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
