import type { Types } from "mongoose";

// The only user shape that leaves the server (API Design §5.1). Never includes passwordAuth or
// provider user ids.
export interface UserDto {
  id: string;
  email: string;
  name: string;
  authProviders: string[];
  hasPassword: boolean;
  /** When the password was last set; null for Google-only accounts. */
  passwordChangedAt: string | null;
  createdAt: string;
}

interface UserLike {
  _id: Types.ObjectId;
  email: string;
  name: string;
  authProviders?: { provider: string }[] | null;
  passwordAuth?: { updatedAt?: Date } | null;
  createdAt?: Date;
}

export function toUserDto(user: UserLike, options: { hasPassword: boolean }): UserDto {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    authProviders: (user.authProviders ?? []).map((provider) => provider.provider),
    hasPassword: options.hasPassword,
    passwordChangedAt: user.passwordAuth?.updatedAt?.toISOString() ?? null,
    createdAt: (user.createdAt ?? new Date(0)).toISOString(),
  };
}
