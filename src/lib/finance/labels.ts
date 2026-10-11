import type {
  ExpenseCategory,
  PaymentMethod,
  PaymentStatus,
  VendorCategory,
  VendorStatus,
} from "@/lib/constants/enums";

// What the Stitch Expenses and Vendors screens call each value. One place, so a list, a form and a
// filter can never name the same thing differently.

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  venue: "Venue",
  catering: "Catering",
  decor: "Decor",
  photography_video: "Photography & video",
  attire: "Attire",
  jewellery: "Jewellery",
  makeup_beauty: "Makeup & beauty",
  music_entertainment: "Music & entertainment",
  invitations_stationery: "Invitations & stationery",
  rituals_ceremony: "Rituals & ceremony",
  travel_stay: "Travel & stay",
  gifts_favours: "Gifts & favours",
  other: "Other",
};

export const VENDOR_CATEGORY_LABEL: Record<VendorCategory, string> = {
  venue: "Venue",
  caterer: "Caterer",
  decorator: "Decorator",
  photographer: "Photographer",
  videographer: "Videographer",
  makeup_artist: "Makeup artist",
  mehendi_artist: "Mehendi artist",
  music_entertainment: "Music & entertainment",
  officiant: "Priest or officiant",
  florist: "Florist",
  jeweller: "Jeweller",
  tailor_designer: "Tailor or designer",
  other: "Other",
};

export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = {
  shortlisted: "Shortlisted",
  contacted: "Contacted",
  booked: "Booked",
  rejected: "Rejected",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI",
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
};

/** The order the Stitch payment form lists methods in. */
export const PAYMENT_METHOD_ORDER: PaymentMethod[] = [
  "upi",
  "cash",
  "bank_transfer",
  "cheque",
  "card",
  "other",
];
