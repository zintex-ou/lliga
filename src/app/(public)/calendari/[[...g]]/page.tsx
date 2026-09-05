import { RoundPage } from "@/components/RoundPage";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ g?: string[] }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { g } = await params; const sp = await searchParams;
  return <RoundPage kind="calendari" g={g} j={sp.j} />;
}
