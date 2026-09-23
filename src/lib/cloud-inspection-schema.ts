import { z } from "zod";
import {
  FindingCategorySchema,
  RiskLevelSchema,
} from "@/lib/schemas";

const CloudPpeLabelSchema = z.enum([
  "Hardhat",
  "Mask",
  "NO-Hardhat",
  "NO-Mask",
  "NO-Safety Vest",
  "Person",
  "Safety Cone",
  "Safety Vest",
  "machinery",
  "vehicle",
]);

const MimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const DetectionSchema = z.object({
  id: z.uuid(),
  client_detection_id: z.string().min(1).max(1000),
  model_name: z.string().min(1).max(100),
  model_version: z.string().min(1).max(100),
  label: CloudPpeLabelSchema,
  confidence: z.number().min(0).max(1),
  box_x: z.number().min(0),
  box_y: z.number().min(0),
  box_width: z.number().positive(),
  box_height: z.number().positive(),
  excluded_by_user: z.boolean(),
});

const PhotoSchema = z.object({
  id: z.uuid(),
  storage_key: z.string().min(1).max(1000),
  original_file_name: z.string().min(1).max(255),
  mime_type: MimeTypeSchema,
  size_bytes: z.number().int().positive().max(10 * 1024 * 1024),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  detections: z.array(DetectionSchema).max(100),
});

const EvidenceSchema = z.object({
  photo_id: z.uuid(),
  detection_id: z.uuid().nullable(),
});

const FindingSchema = z.object({
  id: z.uuid(),
  category: FindingCategorySchema,
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  visible_evidence: z.string().min(1).max(5000),
  risk_level: RiskLevelSchema,
  corrective_action: z.string().min(1).max(5000),
  uncertainty: z.array(z.string().max(500)).max(50),
  origin: z.enum(["AI", "HUMAN"]),
  modified_by_human: z.boolean(),
  evidence: z.array(EvidenceSchema).max(1000),
});

export const CreateInspectionDraftSchema = z.object({
  projectId: z.uuid(),
  location: z.string().trim().min(1).max(300),
  note: z.string().max(5000),
  summary: z.string().max(5000),
});

export const CloudInspectionPayloadSchema = z.object({
  photos: z.array(PhotoSchema).min(1).max(10),
  findings: z.array(FindingSchema).max(100),
});

export type CloudInspectionPayload = z.infer<
  typeof CloudInspectionPayloadSchema
>;

export type CloudProject = {
  id: string;
  name: string;
  code: string;
};
