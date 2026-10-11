import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/env";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  createVendor,
  deleteVendor,
  getExpense,
  getVendor,
  listVendors,
  makeExpense,
  makePayment,
  makeVendor,
  patchVendor,
  searchPlaces,
} from "./helpers";

setupTestDatabase();

describe("vendors are for owners and admins only", () => {
  it("refuses a member on every route", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const vendor = await makeVendor(weddingId, owner);
    const responses = [
      await createVendor(weddingId, member, { name: "x", category: "other" }),
      await listVendors(weddingId, member),
      await getVendor(weddingId, vendor.id, member),
      await patchVendor(weddingId, vendor.id, member, { version: 0, name: "y" }),
      await deleteVendor(weddingId, vendor.id, member),
      await searchPlaces(weddingId, member, "photographers"),
    ];
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.json.error.code).toBe("INSUFFICIENT_ROLE");
    }
  });

  it("lets an admin do everything an owner can", async () => {
    const { weddingId } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const vendor = await makeVendor(weddingId, admin);
    expect((await patchVendor(weddingId, vendor.id, admin, { version: 0, name: "y" })).status).toBe(
      200,
    );
    expect((await deleteVendor(weddingId, vendor.id, admin)).status).toBe(200);
  });
});

describe("POST /weddings/:weddingId/vendors", () => {
  it("adds a vendor with contact, location and notes", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await createVendor(weddingId, owner, {
      name: "Lens & Light Studio",
      category: "photographer",
      status: "booked",
      contact: {
        personName: "Rohan Mehta",
        phone: "+919825014820",
        email: "rohan@lenslightstudio.in",
        website: "https://lenslightstudio.in",
      },
      location: {
        label: "Lens & Light Studio",
        address: {
          line1: "Studio 402, Riverfront Arcade, Nanpura",
          city: "Surat",
          state: "Gujarat",
        },
        placeId: "ChIJ-example",
      },
      source: "google_places",
      notes: "Quoted 1.65L for full coverage",
    });
    expect(result.status).toBe(201);
    expect(result.json.data).toMatchObject({
      name: "Lens & Light Studio",
      category: "photographer",
      status: "booked",
      contact: {
        personName: "Rohan Mehta",
        phone: "+919825014820",
        email: "rohan@lenslightstudio.in",
        website: "https://lenslightstudio.in",
      },
      location: { label: "Lens & Light Studio", placeId: "ChIJ-example" },
      source: "google_places",
      notes: "Quoted 1.65L for full coverage",
      money: { expenseCount: 0, costMinor: 0, paidMinor: 0 },
      version: 0,
    });
    expect(result.json.data.location.address).toMatchObject({ city: "Surat", country: "IN" });
  });

  it("defaults to shortlisted and a manual source", async () => {
    const { weddingId, owner } = await setupWedding();
    const created = await makeVendor(weddingId, owner);
    expect(created).toMatchObject({ status: "shortlisted", source: "manual", contact: null });
  });

  it.each([
    ["no name", { name: " " }],
    ["a name over 150 characters", { name: "x".repeat(151) }],
    ["an unknown category", { category: "magician" }],
    ["an unknown status", { status: "ghosted" }],
    ["an http website (it must be https)", { contact: { website: "http://example.com" } }],
    ["a website that is not a link", { contact: { website: "lenslight" } }],
    ["a phone not in international format", { contact: { phone: "98250 14820" } }],
    ["an invalid email", { contact: { email: "nope" } }],
    ["a bank account number (never stored)", { contact: { accountNumber: "123" } }],
    ["a UPI id field (never stored)", { upiId: "x@bank" }],
    ["a card field (never stored)", { card: "4111111111111111" }],
    ["half a pair of coordinates", { location: { coordinates: { latitude: 21.1 } } }],
    ["notes over 2000 characters", { notes: "n".repeat(2001) }],
  ])("rejects %s", async (_label, patch) => {
    const { weddingId, owner } = await setupWedding();
    const result = await createVendor(weddingId, owner, {
      name: "Lens & Light Studio",
      category: "photographer",
      ...patch,
    });
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /weddings/:weddingId/vendors", () => {
  it("filters by name prefix, category and status and pages A to Z", async () => {
    const { weddingId, owner } = await setupWedding();
    await makeVendor(weddingId, owner, { name: "Lens & Light", category: "photographer" });
    await makeVendor(weddingId, owner, {
      name: "Royal Palace Gardens",
      category: "venue",
      status: "booked",
    });
    await makeVendor(weddingId, owner, { name: "Royal Rasoi", category: "caterer" });

    const names = async (query: string) =>
      (await listVendors(weddingId, owner, query)).json.data
        .map((row: { name: string }) => row.name)
        .sort();
    expect(await names("")).toEqual(["Lens & Light", "Royal Palace Gardens", "Royal Rasoi"]);
    expect(await names("?search=roy")).toEqual(["Royal Palace Gardens", "Royal Rasoi"]);
    expect(await names("?search=ROYAL%20P")).toEqual(["Royal Palace Gardens"]);
    expect(await names("?category=venue")).toEqual(["Royal Palace Gardens"]);
    expect(await names("?status=booked")).toEqual(["Royal Palace Gardens"]);
    expect(await names("?status=booked&category=caterer")).toEqual([]);
    // A regex character in the search is text, not a pattern.
    expect(await names("?search=.*")).toEqual([]);

    const first = await listVendors(weddingId, owner, "?limit=2");
    expect(first.json.data.map((row: { name: string }) => row.name)).toEqual([
      "Lens & Light",
      "Royal Palace Gardens",
    ]);
    expect(first.json.meta.hasMore).toBe(true);
    const second = await listVendors(
      weddingId,
      owner,
      `?limit=2&cursor=${first.json.meta.nextCursor}`,
    );
    expect(second.json.data.map((row: { name: string }) => row.name)).toEqual(["Royal Rasoi"]);
    expect(second.json.meta.hasMore).toBe(false);
    expect((await listVendors(weddingId, owner, "?cursor=garbage")).status).toBe(400);
    expect((await listVendors(weddingId, owner, "?bogus=1")).status).toBe(400);
  });

  it("shows what each vendor is owed and has been paid, from the linked expenses", async () => {
    const { weddingId, owner } = await setupWedding();
    const vendor = await makeVendor(weddingId, owner);
    const photos = await makeExpense(weddingId, owner, {
      vendorId: vendor.id,
      agreedAmountMinor: 16500000,
    });
    await makePayment(weddingId, photos.id, owner, { amountMinor: 5000000, status: "paid" });
    await makeExpense(weddingId, owner, {
      title: "Album",
      vendorId: vendor.id,
      estimatedAmountMinor: 1000000,
    });
    const list = await listVendors(weddingId, owner);
    expect(list.json.data[0].money).toEqual({
      expenseCount: 2,
      costMinor: 17500000,
      paidMinor: 5000000,
    });
  });

  it("never lists another wedding's vendors", async () => {
    const a = await setupWedding();
    const b = await setupWedding();
    await makeVendor(a.weddingId, a.owner, { name: "Mine" });
    await makeVendor(b.weddingId, b.owner, { name: "Theirs" });
    const list = await listVendors(a.weddingId, a.owner);
    expect(list.json.data.map((row: { name: string }) => row.name)).toEqual(["Mine"]);
    expect((await listVendors(a.weddingId, b.owner)).status).toBe(403);
    const text = JSON.stringify(list.json);
    for (const forbidden of ["weddingId", "deletedAt", "nameNormalized", "__v"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("GET /weddings/:weddingId/vendors/:vendorId", () => {
  it("returns the vendor with its linked expenses and the totals", async () => {
    const { weddingId, owner } = await setupWedding();
    const vendor = await makeVendor(weddingId, owner);
    const expense = await makeExpense(weddingId, owner, {
      vendorId: vendor.id,
      agreedAmountMinor: 16500000,
    });
    await makePayment(weddingId, expense.id, owner, { amountMinor: 5000000, status: "paid" });
    await makeExpense(weddingId, owner, { title: "Unrelated", agreedAmountMinor: 1 });
    const result = await getVendor(weddingId, vendor.id, owner);
    expect(result.status).toBe(200);
    expect(result.json.data.vendor.money).toEqual({
      expenseCount: 1,
      costMinor: 16500000,
      paidMinor: 5000000,
    });
    expect(result.json.data.expenses).toHaveLength(1);
    expect(result.json.data.expenses[0]).toMatchObject({
      title: "Photography package",
      paidAmountMinor: 5000000,
      remainingAmountMinor: 11500000,
    });
  });

  it("answers 404 for a vendor in another wedding or one that was deleted", async () => {
    const a = await setupWedding();
    const b = await setupWedding();
    const theirs = await makeVendor(b.weddingId, b.owner);
    expect((await getVendor(a.weddingId, theirs.id, a.owner)).status).toBe(404);
    const mine = await makeVendor(a.weddingId, a.owner);
    await deleteVendor(a.weddingId, mine.id, a.owner);
    expect((await getVendor(a.weddingId, mine.id, a.owner)).status).toBe(404);
  });
});

describe("PATCH /weddings/:weddingId/vendors/:vendorId", () => {
  it("changes the status, replaces contact as a whole and clears optional fields", async () => {
    const { weddingId, owner } = await setupWedding();
    const vendor = await makeVendor(weddingId, owner, {
      contact: { personName: "Rohan", phone: "+919825014820" },
      notes: "n",
    });
    const result = await patchVendor(weddingId, vendor.id, owner, {
      version: 0,
      status: "booked",
      contact: { personName: "Rohan Mehta" },
      notes: null,
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      status: "booked",
      contact: { personName: "Rohan Mehta", phone: null },
      notes: null,
      version: 1,
    });
    const cleared = await patchVendor(weddingId, vendor.id, owner, {
      version: 1,
      contact: null,
      location: null,
    });
    expect(cleared.json.data).toMatchObject({ contact: null, location: null });
  });

  it("rejects a stale version and an empty change", async () => {
    const { weddingId, owner } = await setupWedding();
    const vendor = await makeVendor(weddingId, owner);
    await patchVendor(weddingId, vendor.id, owner, { version: 0, name: "First" });
    const stale = await patchVendor(weddingId, vendor.id, owner, { version: 0, name: "Second" });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("VERSION_CONFLICT");
    expect((await patchVendor(weddingId, vendor.id, owner, { version: 1 })).status).toBe(400);
  });

  it("cannot reach another wedding's vendor", async () => {
    const a = await setupWedding();
    const b = await setupWedding();
    const theirs = await makeVendor(b.weddingId, b.owner);
    expect(
      (await patchVendor(a.weddingId, theirs.id, a.owner, { version: 0, name: "Hijack" })).status,
    ).toBe(404);
    expect((await deleteVendor(a.weddingId, theirs.id, a.owner)).status).toBe(404);
  });
});

describe("DELETE /weddings/:weddingId/vendors/:vendorId", () => {
  it("keeps the vendor's expenses but unlinks them, and says how many", async () => {
    const { weddingId, owner } = await setupWedding();
    const vendor = await makeVendor(weddingId, owner);
    const expense = await makeExpense(weddingId, owner, {
      vendorId: vendor.id,
      agreedAmountMinor: 500,
    });
    const result = await deleteVendor(weddingId, vendor.id, owner);
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ id: vendor.id, expensesUnlinked: 1 });
    const after = await getExpense(weddingId, expense.id, owner);
    expect(after.json.data.expense).toMatchObject({ vendorId: null, vendorName: null });
    expect(after.json.data.expense.costMinor).toBe(500);
    expect((await listVendors(weddingId, owner)).json.data).toEqual([]);
  });
});

describe("GET /weddings/:weddingId/vendors/search-places", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    resetEnvCacheForTests();
  });

  it("says search is not set up (and still works) when there is no Google key", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    resetEnvCacheForTests();
    const { weddingId, owner } = await setupWedding();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await searchPlaces(weddingId, owner, "photographers in Surat");
    expect(result.status).toBe(200);
    expect(result.json.data).toEqual([]);
    expect(result.json.meta).toEqual({ configured: false, unavailable: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("asks Google from the server and returns only id, name and address", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-places-key-123");
    resetEnvCacheForTests();
    const { weddingId, owner } = await setupWedding();
    const fetchSpy = vi.fn(async () =>
      Response.json({
        places: [
          {
            id: "ChIJ1",
            displayName: { text: "Lens & Light Studio" },
            formattedAddress: "Nanpura, Surat, Gujarat",
            location: { latitude: 21.19, longitude: 72.83 },
            nationalPhoneNumber: "098250 14820",
          },
          { id: "ChIJ2", displayName: { text: "The Wedding Filmer" } },
          { displayName: { text: "No id, dropped" } },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await searchPlaces(weddingId, owner, "photographers in Surat");
    expect(result.status).toBe(200);
    expect(result.json.data).toEqual([
      { placeId: "ChIJ1", name: "Lens & Light Studio", address: "Nanpura, Surat, Gujarat" },
      { placeId: "ChIJ2", name: "The Wedding Filmer", address: "" },
    ]);
    expect(result.json.meta).toEqual({ configured: true, unavailable: false });
    // The key went to Google in a header, never into our response.
    expect(JSON.stringify(result.json)).not.toContain("test-places-key-123");
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-places-key-123");
    expect(JSON.parse(init.body as string)).toMatchObject({ textQuery: "photographers in Surat" });
  });

  it("saves nothing: the search never creates a vendor", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-places-key-123");
    resetEnvCacheForTests();
    const { weddingId, owner } = await setupWedding();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ places: [{ id: "ChIJ1", displayName: { text: "A" } }] })),
    );
    await searchPlaces(weddingId, owner, "photographers");
    expect((await listVendors(weddingId, owner)).json.data).toEqual([]);
  });

  it.each([
    ["Google answering with an error", () => new Response("denied", { status: 403 })],
    ["Google being unreachable", () => Promise.reject(new TypeError("fetch failed"))],
  ])("treats %s as a calm 'unavailable', not an error", async (_label, behaviour) => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-places-key-123");
    resetEnvCacheForTests();
    const { weddingId, owner } = await setupWedding();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => behaviour()),
    );
    const result = await searchPlaces(weddingId, owner, "photographers");
    expect(result.status).toBe(200);
    expect(result.json.data).toEqual([]);
    expect(result.json.meta).toEqual({ configured: true, unavailable: true });
  });

  it("rejects an empty or too-short search, and rate limits a busy wedding", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-places-key-123");
    resetEnvCacheForTests();
    const { weddingId, owner } = await setupWedding();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ places: [] })),
    );
    expect((await searchPlaces(weddingId, owner, "")).status).toBe(400);
    expect((await searchPlaces(weddingId, owner, "a")).status).toBe(400);
    let last = 200;
    for (let i = 0; i < 41; i++)
      last = (await searchPlaces(weddingId, owner, "photographers")).status;
    expect(last).toBe(429);
  });
});
