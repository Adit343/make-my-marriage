import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as callback } from "@/app/api/v1/auth/google/callback/route";
import { GET as start } from "@/app/api/v1/auth/google/route";
import { POST as createWedding } from "@/app/api/v1/weddings/route";
import { setGoogleJwksForTests } from "@/infrastructure/oauth/google";
import { resetEnvCacheForTests } from "@/lib/env";
import { User } from "@/models/user.model";
import { freshIp, signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call, cookiePair } from "../../setup/http";

setupTestDatabase();

const CLIENT_ID = "test-client.apps.googleusercontent.com";
let googleKey: CryptoKey;
let attackerKey: CryptoKey;

beforeAll(async () => {
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  resetEnvCacheForTests();

  const google = await generateKeyPair("RS256");
  const attacker = await generateKeyPair("RS256");
  googleKey = google.privateKey;
  attackerKey = attacker.privateKey;
  const publicJwk: JWK = {
    ...(await exportJWK(google.publicKey)),
    kid: "google-key",
    alg: "RS256",
  };
  setGoogleJwksForTests(createLocalJWKSet({ keys: [publicJwk] }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(() => {
  setGoogleJwksForTests(undefined);
});

interface Claims {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  nonce?: string;
  aud?: string;
}

async function idToken(claims: Claims, key: CryptoKey = googleKey) {
  return new SignJWT({
    email: claims.email,
    email_verified: claims.email_verified ?? true,
    name: claims.name,
    nonce: claims.nonce,
  })
    .setProtectedHeader({ alg: "RS256", kid: "google-key" })
    .setIssuer("https://accounts.google.com")
    .setAudience(claims.aud ?? CLIENT_ID)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

/** Runs the start route, then fakes Google's token endpoint returning a token built from `claims`. */
async function signInWithGoogle(
  claims: Omit<Claims, "nonce"> & { nonce?: string },
  options: { key?: CryptoKey; tamperState?: boolean; dropCookie?: boolean; next?: string } = {},
) {
  const startPath = options.next
    ? `/api/v1/auth/google?next=${encodeURIComponent(options.next)}`
    : "/api/v1/auth/google";
  const started = await call(start, { method: "GET", path: startPath, ip: freshIp() });
  const authorizeUrl = new URL(started.headers.get("location")!);
  const state = authorizeUrl.searchParams.get("state")!;
  const nonce = authorizeUrl.searchParams.get("nonce")!;
  const oauthCookie = cookiePair(started.setCookies, "mmm_oauth")!;

  const token = await idToken({ ...claims, nonce: claims.nonce ?? nonce }, options.key);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ id_token: token, access_token: "unused" })),
  );

  const query = new URLSearchParams({
    code: "auth-code",
    state: options.tamperState ? "forged" : state,
  });
  return call(callback, {
    method: "GET",
    path: `/api/v1/auth/google/callback?${query}`,
    cookie: options.dropCookie ? undefined : oauthCookie,
  });
}

const errorOf = (result: { headers: Headers }) =>
  new URL(result.headers.get("location")!, "http://localhost").searchParams.get("error");

describe("GET /api/v1/auth/google", () => {
  it("redirects to Google with PKCE (S256), state and nonce, in a scoped HttpOnly cookie", async () => {
    const result = await call(start, { method: "GET", ip: freshIp() });
    expect(result.status).toBe(303);

    const url = new URL(result.headers.get("location")!);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/v1/auth/google/callback",
    );

    const cookie = result.setCookies.find((c) => c.startsWith("mmm_oauth="))!;
    expect(cookie).toContain("Path=/api/v1/auth/google");
    expect(cookie).toContain("HttpOnly");
    // The verifier never appears in the browser-visible URL.
    expect(result.headers.get("location")).not.toContain("code_verifier");
  });
});

describe("GET /api/v1/auth/google/callback", () => {
  it("creates a password-less account for a new Google user and signs them in", async () => {
    const result = await signInWithGoogle({
      sub: "g-new",
      email: "anaya@gmail.com",
      name: "Anaya Rao",
    });

    expect(result.status).toBe(303);
    // No wedding yet → workspace setup (onboarding) before the dashboard.
    expect(result.headers.get("location")).toBe("/onboarding");
    expect(cookiePair(result.setCookies, "mmm_session")).toBeDefined();

    const user = await User.findOne({ emailNormalized: "anaya@gmail.com" })
      .select("+passwordAuth")
      .lean();
    expect(user).toMatchObject({ name: "Anaya Rao", passwordAuth: null });
    expect(user?.authProviders.map((p) => p.providerUserId)).toEqual(["g-new"]);
  });

  it("signs a returning Google user into the same account", async () => {
    await signInWithGoogle({ sub: "g-returning", email: "kabir@gmail.com" });
    const again = await signInWithGoogle({ sub: "g-returning", email: "kabir@gmail.com" });
    expect(again.headers.get("location")).toBe("/onboarding");
    expect(await User.countDocuments({ emailNormalized: "kabir@gmail.com" })).toBe(1);
  });

  it("returns an invited newcomer to their invitation link", async () => {
    const link = `/join/${"Tok3n_-".repeat(6)}`;
    const result = await signInWithGoogle(
      { sub: "g-invited", email: "invited@gmail.com" },
      { next: link },
    );
    expect(result.headers.get("location")).toBe(link);
  });

  it("ignores a next that isn't an invitation link (no open redirect)", async () => {
    for (const next of ["https://evil.example/", "//evil.example", "/dashboard", "/join/short"]) {
      const result = await signInWithGoogle(
        { sub: `g-${Math.random()}`, email: `x${Math.random()}@gmail.com` },
        { next },
      );
      expect(result.headers.get("location"), next).toBe("/onboarding");
    }
  });

  it("does not send someone who already has a wedding to an invitation link", async () => {
    const first = await signInWithGoogle({ sub: "g-busy", email: "busy@gmail.com" });
    await call(createWedding, {
      cookie: cookiePair(first.setCookies, "mmm_session"),
      body: { title: "Busy & Co", relationship: "couple" },
    });
    const again = await signInWithGoogle(
      { sub: "g-busy", email: "busy@gmail.com" },
      { next: `/join/${"Tok3n_-".repeat(6)}` },
    );
    expect(again.headers.get("location")).toBe("/dashboard");
  });

  it("sends a returning Google user who already has a wedding straight to the dashboard", async () => {
    const first = await signInWithGoogle({ sub: "g-owner", email: "isha@gmail.com" });
    const created = await call(createWedding, {
      cookie: cookiePair(first.setCookies, "mmm_session"),
      body: { title: "Isha & Dev", relationship: "couple" },
    });
    expect(created.status).toBe(201);

    const again = await signInWithGoogle({ sub: "g-owner", email: "isha@gmail.com" });
    expect(again.headers.get("location")).toBe("/dashboard");
  });

  it("never attaches Google to an existing password account (pre-hijacking guard)", async () => {
    const { email } = await signUpUser("victim@example.com");
    const result = await signInWithGoogle({ sub: "g-victim", email });

    expect(errorOf(result)).toBe("email_exists_password");
    expect(cookiePair(result.setCookies, "mmm_session")).toBeUndefined();
    const user = await User.findOne({ emailNormalized: email }).lean();
    expect(user?.authProviders).toEqual([]);
  });

  type AttackCase = [
    label: string,
    options: { tamperState?: boolean; dropCookie?: boolean; key?: "attacker" },
    claims: Partial<Claims>,
  ];

  it.each<AttackCase>([
    ["a forged state", { tamperState: true }, {}],
    ["a missing state cookie", { dropCookie: true }, {}],
    ["an unverified Google email", {}, { email_verified: false }],
    ["a token signed by someone else", { key: "attacker" }, {}],
    ["a token for another app", {}, { aud: "someone-else.apps.googleusercontent.com" }],
    ["a replayed nonce", {}, { nonce: "not-the-nonce-we-issued" }],
  ])("rejects %s", async (_label, options, claims) => {
    const result = await signInWithGoogle(
      { sub: "g-attack", email: "attack@gmail.com", ...claims },
      { ...options, key: options.key === "attacker" ? attackerKey : undefined },
    );
    expect(result.status).toBe(303);
    expect(errorOf(result)).toBe("oauth_failed");
    expect(cookiePair(result.setCookies, "mmm_session")).toBeUndefined();
    expect(await User.countDocuments({ emailNormalized: "attack@gmail.com" })).toBe(0);
  });

  it("reports Google sign-in as unavailable when it isn't configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    resetEnvCacheForTests();
    try {
      const result = await call(start, { method: "GET", ip: freshIp() });
      expect(result.headers.get("location")).toBe("/login?error=oauth_unavailable");
    } finally {
      vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT_ID);
      resetEnvCacheForTests();
    }
  });
});
