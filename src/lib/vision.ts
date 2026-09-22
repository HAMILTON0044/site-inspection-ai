"use client";

import * as ort from "onnxruntime-web/all";

const MODEL_URL = "/models/construction-ppe-yolov8n.onnx";
const INPUT_SIZE = 640;
const OUTPUT_BOX_COUNT = 8400;
const CLASS_COUNT = 10;

export const PPE_LABELS = [
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
] as const;

export type PpeLabel = (typeof PPE_LABELS)[number];

export type VisionDetection = {
  classId: number;
  label: PpeLabel;
  confidence: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type Candidate = VisionDetection & {
  x2: number;
  y2: number;
};

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function getSession(): Promise<ort.InferenceSession> {
  if (sessionPromise === null) {
    ort.env.wasm.numThreads = 1;
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["webgpu", "wasm"],
      graphOptimizationLevel: "all",
    });
  }

  return sessionPromise;
}

function intersectionOverUnion(a: Candidate, b: Candidate): number {
  const intersectionWidth = Math.max(
    0,
    Math.min(a.x2, b.x2) - Math.max(a.box.x, b.box.x),
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(a.y2, b.y2) - Math.max(a.box.y, b.box.y),
  );
  const intersectionArea = intersectionWidth * intersectionHeight;
  const aArea = a.box.width * a.box.height;
  const bArea = b.box.width * b.box.height;

  return intersectionArea / (aArea + bArea - intersectionArea);
}

function applyNonMaximumSuppression(
  candidates: Candidate[],
  iouThreshold: number,
): VisionDetection[] {
  const sorted = candidates.sort(
    (a, b) => b.confidence - a.confidence,
  );
  const selected: Candidate[] = [];

  for (const candidate of sorted) {
    const overlapsSelectedBox = selected.some(
      (existing) =>
        existing.classId === candidate.classId &&
        intersectionOverUnion(existing, candidate) > iouThreshold,
    );

    if (!overlapsSelectedBox) {
      selected.push(candidate);
    }

    if (selected.length >= 100) {
      break;
    }
  }

  return selected.map((candidate) => ({
    classId: candidate.classId,
    label: candidate.label,
    confidence: candidate.confidence,
    box: candidate.box,
  }));
}

function createInputTensor(bitmap: ImageBitmap) {
  const scale = Math.min(
    INPUT_SIZE / bitmap.width,
    INPUT_SIZE / bitmap.height,
  );
  const resizedWidth = Math.round(bitmap.width * scale);
  const resizedHeight = Math.round(bitmap.height * scale);
  const padX = Math.floor((INPUT_SIZE - resizedWidth) / 2);
  const padY = Math.floor((INPUT_SIZE - resizedHeight) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;

  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (context === null) {
    throw new Error("当前浏览器无法创建图像分析画布。");
  }

  context.fillStyle = "rgb(114, 114, 114)";
  context.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  context.drawImage(
    bitmap,
    padX,
    padY,
    resizedWidth,
    resizedHeight,
  );

  const rgba = context.getImageData(
    0,
    0,
    INPUT_SIZE,
    INPUT_SIZE,
  ).data;
  const planeSize = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(planeSize * 3);

  for (let pixelIndex = 0; pixelIndex < planeSize; pixelIndex += 1) {
    const rgbaIndex = pixelIndex * 4;
    input[pixelIndex] = rgba[rgbaIndex] / 255;
    input[planeSize + pixelIndex] = rgba[rgbaIndex + 1] / 255;
    input[planeSize * 2 + pixelIndex] = rgba[rgbaIndex + 2] / 255;
  }

  return {
    tensor: new ort.Tensor("float32", input, [
      1,
      3,
      INPUT_SIZE,
      INPUT_SIZE,
    ]),
    scale,
    padX,
    padY,
  };
}

function parseOutput(
  output: ort.Tensor,
  imageWidth: number,
  imageHeight: number,
  scale: number,
  padX: number,
  padY: number,
  confidenceThreshold: number,
  iouThreshold: number,
): VisionDetection[] {
  const values = output.data as Float32Array;

  if (
    output.dims[1] !== CLASS_COUNT + 4 ||
    output.dims[2] !== OUTPUT_BOX_COUNT
  ) {
    throw new Error(
      `模型输出结构不受支持：${output.dims.join(" × ")}`,
    );
  }

  const candidates: Candidate[] = [];

  for (let boxIndex = 0; boxIndex < OUTPUT_BOX_COUNT; boxIndex += 1) {
    let classId = 0;
    let confidence = values[4 * OUTPUT_BOX_COUNT + boxIndex];

    for (let currentClass = 1; currentClass < CLASS_COUNT; currentClass += 1) {
      const currentConfidence =
        values[(currentClass + 4) * OUTPUT_BOX_COUNT + boxIndex];

      if (currentConfidence > confidence) {
        confidence = currentConfidence;
        classId = currentClass;
      }
    }

    if (confidence < confidenceThreshold) {
      continue;
    }

    const centerX = values[boxIndex];
    const centerY = values[OUTPUT_BOX_COUNT + boxIndex];
    const width = values[OUTPUT_BOX_COUNT * 2 + boxIndex];
    const height = values[OUTPUT_BOX_COUNT * 3 + boxIndex];
    const x1 = Math.max(0, (centerX - width / 2 - padX) / scale);
    const y1 = Math.max(0, (centerY - height / 2 - padY) / scale);
    const x2 = Math.min(
      imageWidth,
      (centerX + width / 2 - padX) / scale,
    );
    const y2 = Math.min(
      imageHeight,
      (centerY + height / 2 - padY) / scale,
    );

    if (x2 <= x1 || y2 <= y1) {
      continue;
    }

    candidates.push({
      classId,
      label: PPE_LABELS[classId],
      confidence,
      box: {
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1,
      },
      x2,
      y2,
    });
  }

  return applyNonMaximumSuppression(candidates, iouThreshold);
}

export async function detectPpe(
  imageFile: File,
  options: {
    confidenceThreshold?: number;
    iouThreshold?: number;
  } = {},
): Promise<VisionDetection[]> {
  const bitmap = await createImageBitmap(imageFile);

  try {
    const { tensor, scale, padX, padY } = createInputTensor(bitmap);
    const session = await getSession();
    const results = await session.run({ images: tensor });
    const output = results.output0;

    if (output === undefined) {
      throw new Error("模型没有返回预期的检测结果。");
    }

    return parseOutput(
      output,
      bitmap.width,
      bitmap.height,
      scale,
      padX,
      padY,
      options.confidenceThreshold ?? 0.35,
      options.iouThreshold ?? 0.45,
    );
  } finally {
    bitmap.close();
  }
}
