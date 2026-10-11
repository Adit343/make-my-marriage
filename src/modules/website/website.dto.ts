import type { Types } from "mongoose";
import type { WebsiteSectionType, WebsiteStatus, WebsiteTemplate } from "@/lib/constants/enums";

// Member-facing website shape (API Design §10.1). The member editor sees the whole stored draft;
// the public page never uses this: it uses the whitelist built in lib/website/site.ts.

export interface WebsiteSectionDto {
  id: string;
  type: WebsiteSectionType;
  title: string;
  body: string;
  isVisible: boolean;
}

export interface WebsiteDto {
  id: string;
  slug: string;
  status: WebsiteStatus;
  publishedAt: string | null;
  title: string;
  tagline: string;
  welcomeMessage: string;
  /** In display order. */
  sections: WebsiteSectionDto[];
  publicEventIds: string[];
  display: { showVenueAddresses: boolean; showCountdown: boolean };
  theme: { templateKey: WebsiteTemplate; accentColor: string };
  seo: { title: string; description: string };
  /** The optimistic-concurrency token sent back on PATCH. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface WebsiteLike {
  _id: Types.ObjectId;
  slug: string;
  status: WebsiteStatus;
  publishedAt?: Date | null;
  title: string;
  tagline?: string | null;
  welcomeMessage?: string | null;
  sections?:
    | {
        _id: Types.ObjectId;
        type: WebsiteSectionType;
        title: string;
        body?: string | null;
        isVisible: boolean;
        sortOrder: number;
      }[]
    | null;
  publicEventIds?: Types.ObjectId[] | null;
  display?: { showVenueAddresses?: boolean | null; showCountdown?: boolean | null } | null;
  theme?: { templateKey?: WebsiteTemplate | null; accentColor?: string | null } | null;
  seo?: { title?: string | null; description?: string | null } | null;
  __v?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export function toWebsiteDto(site: WebsiteLike): WebsiteDto {
  return {
    id: site._id.toString(),
    slug: site.slug,
    status: site.status,
    publishedAt: site.publishedAt ? site.publishedAt.toISOString() : null,
    title: site.title,
    tagline: site.tagline ?? "",
    welcomeMessage: site.welcomeMessage ?? "",
    sections: [...(site.sections ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((section) => ({
        id: section._id.toString(),
        type: section.type,
        title: section.title,
        body: section.body ?? "",
        isVisible: section.isVisible,
      })),
    publicEventIds: (site.publicEventIds ?? []).map((id) => id.toString()),
    display: {
      showVenueAddresses: site.display?.showVenueAddresses ?? false,
      showCountdown: site.display?.showCountdown ?? true,
    },
    theme: {
      templateKey: site.theme?.templateKey ?? "modern_minimal",
      accentColor: site.theme?.accentColor ?? "#1F4D3D",
    },
    seo: { title: site.seo?.title ?? "", description: site.seo?.description ?? "" },
    version: site.__v ?? 0,
    createdAt: (site.createdAt ?? new Date(0)).toISOString(),
    updatedAt: (site.updatedAt ?? new Date(0)).toISOString(),
  };
}
