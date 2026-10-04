import { route } from "@/lib/http/route";

// Liveness check for deployment/uptime monitoring. Touches no database or secrets.
export const GET = route({}, async () => ({ data: { status: "ok" } }));
