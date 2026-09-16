import { z } from "zod";

export const FindingCategorySchema = z.enum([
  "BLOCKED_ACCESS",
  "UNSAFE_CABLE",
  "MISSING_PPE",
  "IMPROPER_STORAGE",
]);

export const RiskLevelSchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
  "UNCONFIRMED",
]);

export const FindingSchema = z.object({
  category: FindingCategorySchema,
  title: z.string().min(1),
  description: z.string().min(1),
  visible_evidence: z.string().min(1),
  risk_level: RiskLevelSchema,
  corrective_action: z.string().min(1),
  uncertainty: z.array(z.string()),
  status: z.literal("AI_DRAFT"),
  requires_human_review: z.literal(true),
});

export const InspectionAnalysisSchema = z.object({
  location: z.string().min(1),
  summary: z.string().min(1),
  findings: z.array(FindingSchema),
});

export type InspectionAnalysis = z.infer<
  typeof InspectionAnalysisSchema
>;