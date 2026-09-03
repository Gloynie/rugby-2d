import GameShell, { type Screen } from "@/components/game/GameShell";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const t = typeof sp.tournament === "string" ? Number(sp.tournament) : NaN;
  const initialScreen: Screen | undefined = Number.isFinite(t) ? { name: "play", tournamentId: t } : undefined;
  return <GameShell initialUser={user} initialScreen={initialScreen} />;
}
