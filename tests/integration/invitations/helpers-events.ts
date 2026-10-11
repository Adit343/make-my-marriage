import { POST as createEventRoute } from "@/app/api/v1/weddings/[weddingId]/events/route";
import { call } from "../../setup/http";
import type { TestMember } from "../../setup/wedding";

/** An event with the fields a test wants to control (name, venue, dress code…). */
export async function createEvent(
  weddingId: string,
  who: TestMember,
  fields: Record<string, unknown> = {},
) {
  const result = await call(createEventRoute, {
    cookie: who.cookie,
    params: { weddingId },
    body: { name: "Haldi", type: "haldi", startsAt: "2027-02-13T04:30:00Z", ...fields },
  });
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data.id as string;
}
