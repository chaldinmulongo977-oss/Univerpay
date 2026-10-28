import { resolveDestination } from "@/lib/session-state";
import { Splash } from "@/components/brand/splash";

export const dynamic = "force-dynamic";

export default async function Home() {
  const destination = await resolveDestination();
  return <Splash destination={destination} />;
}
