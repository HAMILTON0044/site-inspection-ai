import { getFindingDashboard } from "@/lib/finding-queries";

export async function GET() {
  const result = await getFindingDashboard();
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ findings: result.data, currentUser: result.currentUser });
}
