import { Schema, type InferSchemaType } from "mongoose";
import { AUTH_PROVIDERS, PASSWORD_HASH_ALGORITHMS, USER_STATUSES } from "@/lib/constants/enums";
import { normalizeEmail } from "@/lib/text/normalize";
import { normalizedFieldsPlugin } from "@/models/plugins/normalize";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";

// DB Design §6.1. One document per person who can log in. Which wedding they belong to lives
// only in weddingMembers (single source of truth) — there is deliberately no weddingId here.

const passwordAuthSchema = new Schema(
  {
    algorithm: { type: String, enum: PASSWORD_HASH_ALGORITHMS, required: true },
    /** Bumped when hashing parameters change, so old hashes are upgraded on next login. */
    version: { type: Number, required: true, min: 1 },
    params: {
      type: new Schema(
        {
          N: { type: Number, required: true },
          r: { type: Number, required: true },
          p: { type: Number, required: true },
          keyLen: { type: Number, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    salt: { type: String, required: true },
    hash: { type: String, required: true },
    updatedAt: { type: Date, required: true },
  },
  { _id: false },
);

const authProviderSchema = new Schema(
  {
    provider: { type: String, enum: AUTH_PROVIDERS, required: true },
    /** Google's stable `sub` claim. */
    providerUserId: { type: String, required: true },
    email: { type: String, trim: true, maxlength: 254 },
    linkedAt: { type: Date, required: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, maxlength: 254 },
    emailNormalized: { type: String, required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    /** null for Google-only accounts. Never selected unless asked for explicitly. */
    passwordAuth: { type: passwordAuthSchema, default: null, select: false },
    authProviders: {
      type: [authProviderSchema],
      default: [],
      validate: {
        validator: (providers: unknown[]) => providers.length <= 5,
        message: "A user can link at most 5 external identities",
      },
    },
    status: { type: String, enum: USER_STATUSES, required: true, default: "active" },
    lastLoginAt: { type: Date, default: null },
    ...softDeleteFields,
  },
  { collection: "users", timestamps: true },
);

userSchema.plugin(softDeletePlugin);
userSchema.plugin(normalizedFieldsPlugin, {
  fields: [{ source: "email", target: "emailNormalized", normalize: normalizeEmail }],
});

// Full (not partial) unique: a soft-deleted user's email stays reserved until anonymization,
// so nobody can register it and inherit the old account's references (DB Design §6.1 rule 4).
userSchema.index({ emailNormalized: 1 }, { unique: true });
userSchema.index(
  { "authProviders.provider": 1, "authProviders.providerUserId": 1 },
  { unique: true, partialFilterExpression: { "authProviders.providerUserId": { $exists: true } } },
);

export type UserRecord = InferSchemaType<typeof userSchema>;
export const User = defineModel("User", userSchema);
