import { SessionView } from "@/components/grid/SessionView";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <SessionView roomId={roomId} />;
}
