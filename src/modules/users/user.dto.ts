import type { Types } from "mongoose";

// The only user shape that leaves the server (API Design §5.1). Never includes passwordAuth or
// provider user ids.
export interface UserDto {
  id: string;
  email: string;
  name: string;
  authProviders: string[];
  hasPassword: boolean;
  createdAt: string;
}

interface UserLike {
  _id: Types.ObjectId;
  email: string;
  name: string;
  authProviders?: { provider: string }[] | null;
  passwordAuth?: unknown;
  createdAt?: Date;
}

export function toUserDto(user: UserLike, options: { hasPassword: boolean }): UserDto {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    authProviders: (user.authProviders ?? []).map((provider) => provider.provider),
    hasPassword: options.hasPassword,
    createdAt: (user.createdAt ?? new Date(0)).toISOString(),
  };
}
