import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Password hashing with Node's scrypt (Architecture §9). Each hash stores its algorithm, version
// and parameters, so the cost can be raised later and old hashes upgraded on the next login.

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
  keyLen: number;
}

export interface PasswordHash {
  algorithm: "scrypt";
  version: number;
  params: ScryptParams;
  salt: string;
  hash: string;
  updatedAt: Date;
}

/** Bump CURRENT_VERSION whenever CURRENT_PARAMS change. */
const CURRENT_VERSION = 1;
const CURRENT_PARAMS: ScryptParams = { N: 32768, r: 8, p: 1, keyLen: 64 };

function deriveKey(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const options: ScryptOptions = {
    N: params.N,
    r: params.r,
    p: params.p,
    // scrypt needs 128 * N * r bytes; the 32 MiB default is exactly at the limit for N=2^15, r=8.
    maxmem: 256 * params.N * params.r,
  };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, params.keyLen, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, CURRENT_PARAMS);
  return {
    algorithm: "scrypt",
    version: CURRENT_VERSION,
    params: { ...CURRENT_PARAMS },
    salt: salt.toString("base64"),
    hash: key.toString("base64"),
    updatedAt: new Date(),
  };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  if (stored.algorithm !== "scrypt") return false;
  const expected = Buffer.from(stored.hash, "base64");
  const actual = await deriveKey(password, Buffer.from(stored.salt, "base64"), stored.params);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** True when the stored hash used older parameters and should be replaced after a login. */
export function needsRehash(stored: PasswordHash): boolean {
  return stored.version < CURRENT_VERSION;
}

let dummyHash: Promise<PasswordHash> | undefined;

/**
 * Runs a full verification against a throwaway hash. Login calls this when the email is unknown,
 * so "no such account" takes as long as "wrong password" and response timing can't reveal
 * which emails are registered.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
  return false;
}
