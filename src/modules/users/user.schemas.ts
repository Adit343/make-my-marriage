import { z } from "zod";

export const updateProfileBody = z.strictObject({ name: z.string().trim().min(1).max(100) });

// DELETE /users/me?deleteWedding=true — the sole owner of a wedding with nobody else in it may
// delete the wedding and the account in one step (API Design §5.3).
export const deleteAccountQuery = z.strictObject({
  deleteWedding: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});
