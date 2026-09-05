import { RankingsPage } from "@/components/Rankings";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ g?: string[] }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { g } = await params; const sp = await searchParams;
  return <RankingsPage kind={sp.t === "ass" ? "ass" : "gol"} g={g} />;
}
