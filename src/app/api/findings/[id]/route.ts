import { getFindingDetail } from "@/lib/finding-queries";

type FindingRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: FindingRouteContext) {
  const { id } = await context.params;
  const result = await getFindingDetail(id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ finding: result.data, currentUser: result.currentUser });
}
