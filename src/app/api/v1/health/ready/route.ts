import { route } from "@/lib/http/route";
import { checkReadiness } from "@/modules/health/health.service";

// Readiness check for uptime monitors: touches the database (unlike /health, which is liveness
// only) and reports whether photo storage and email are configured.
export const GET = route({}, async () => ({ data: await checkReadiness() }));
