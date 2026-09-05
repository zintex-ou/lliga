import { RankingsPage } from "@/components/Rankings";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ g?: string[] }> }) {
  const { g } = await params;
  return <RankingsPage kind="disc" g={g} />;
}
