import { getCloudInspectionList } from "@/lib/cloud-inspection-queries";

export async function GET() {
  const result = await getCloudInspectionList();

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ inspections: result.data });
}
