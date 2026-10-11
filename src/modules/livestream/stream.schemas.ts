import { z } from "zod";
import { STREAM_PROVIDERS, STREAM_STATUSES } from "@/lib/constants/enums";
import { MAX_STREAM_DESCRIPTION, MAX_STREAM_TITLE, MAX_STREAM_URL } from "@/lib/constants/website";
import { checkStreamUrl } from "@/lib/livestream/provider";
import { objectId } from "@/lib/validation/primitives";

// API Design §11. A stream's address is checked against the platform chosen with it: a YouTube
// stream must be a YouTube link (DB Design §6.16). `status` is set by hand by a member.

export const streamParams = z.object({ weddingId: objectId, streamId: objectId });

/** Loose on purpose: ANY unusable link is the same `INVALID_TOKEN` answer. */
export const liveTokenParams = z.object({ token: z.string().min(1).max(200) });

const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const title = z.string().trim().min(1, "Give the stream a title").max(MAX_STREAM_TITLE);
const description = z.string().trim().max(MAX_STREAM_DESCRIPTION);
const streamUrl = z.string().trim().min(1, "Paste the stream link").max(MAX_STREAM_URL);

export const createStreamBody = z
  .strictObject({
    eventId: objectId.nullable().optional(),
    provider: z.enum(STREAM_PROVIDERS),
    streamUrl,
    title,
    description: description.optional(),
    startTime: instant,
    status: z.enum(STREAM_STATUSES).optional(),
  })
  .superRefine((body, context) => {
    const check = checkStreamUrl(body.provider, body.streamUrl);
    if (!check.ok)
      context.addIssue({ code: "custom", path: ["streamUrl"], message: check.message });
  });
export type CreateStreamInput = z.infer<typeof createStreamBody>;

// Any subset plus the `version` the client last read (decision C5). null clears an optional field.
export const updateStreamBody = z
  .strictObject({
    version: z.number().int().min(0),
    eventId: objectId.nullable(),
    provider: z.enum(STREAM_PROVIDERS),
    streamUrl,
    title,
    description: description.nullable(),
    startTime: instant,
    status: z.enum(STREAM_STATUSES),
  })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });
export type UpdateStreamInput = z.infer<typeof updateStreamBody>;
