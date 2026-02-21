import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { DocAstSchema } from "../types/docast.js";
import { authService } from "../auth/index.js";

export interface ImageCaption {
  role: "diagram" | "screenshot" | "chart" | "photo" | "whiteboard" | "unknown";
  summary: string;
  key_points: string[];
  need_open_image_when: string[];
  confidence: number;
}

export interface ImageCaptioner {
  caption(input: {
    imagePath: string;
    nearbyContext: string;
    assetId: string;
  }): Promise<ImageCaption>;
}

const CaptionSchema = z.object({
  role: z
    .enum(["diagram", "screenshot", "chart", "photo", "whiteboard", "unknown"])
    .default("unknown"),
  summary: z.string().default(""),
  key_points: z.array(z.string()).default([]),
  need_open_image_when: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

class MockImageCaptioner implements ImageCaptioner {
  async caption(input: {
    imagePath: string;
    nearbyContext: string;
    assetId: string;
  }): Promise<ImageCaption> {
    const shortContext = input.nearbyContext.slice(0, 160).replace(/\s+/g, " ").trim();
    return {
      role: "unknown",
      summary: shortContext
        ? `Image ${input.assetId} likely supports nearby content: ${shortContext}`
        : `Image ${input.assetId} extracted from document.`,
      key_points: [
        `asset_path=${input.imagePath}`,
        "Replace with multimodal model output in production.",
      ],
      need_open_image_when: ["Need exact values, tiny text, or visual layout details."],
      confidence: 0.35,
    };
  }
}

function guessMime(imagePath: string): string {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

class OpenAIImageCaptioner implements ImageCaptioner {
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(params: { model?: string; baseUrl?: string }) {
    this.model = params.model ?? "gpt-5.2";
    this.baseUrl = params.baseUrl ?? "https://api.openai.com/v1";
  }

  async caption(input: {
    imagePath: string;
    nearbyContext: string;
    assetId: string;
  }): Promise<ImageCaption> {
    const image = await readFile(input.imagePath);
    const mime = guessMime(input.imagePath);
    const dataUrl = `data:${mime};base64,${image.toString("base64")}`;

    const instruction =
      "You are extracting a compact digest for an image in a technical document. " +
      "Return only JSON with keys: role, summary, key_points, need_open_image_when, confidence. " +
      "Keep summary <= 30 words; key_points 2-5 concise items; confidence 0..1.";

    const jsonSchema = {
      name: "image_digest",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          role: {
            type: "string",
            enum: ["diagram", "screenshot", "chart", "photo", "whiteboard", "unknown"],
          },
          summary: { type: "string" },
          key_points: {
            type: "array",
            items: { type: "string" },
          },
          need_open_image_when: {
            type: "array",
            items: { type: "string" },
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["role", "summary", "key_points", "need_open_image_when", "confidence"],
      },
      strict: true,
    };

    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      } as Record<string, string>,
      body: JSON.stringify({
        model: this.model,
        text: {
          format: {
            type: "json_schema",
            json_schema: jsonSchema,
          },
        },
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: instruction }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  `Asset ID: ${input.assetId}\n` +
                  `Nearby markdown context:\n${input.nearbyContext || "(empty)"}`,
              },
              {
                type: "input_image",
                image_url: dataUrl,
              },
            ],
          },
        ],
      }),
    };

    try {
      // Use the new standard Auth Subsystem
      await authService.injectAuth("openai", requestOptions);
    } catch (err) {
      // Fallback for backward compatibility if user hasn't run `auth login openai`
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        (requestOptions.headers as Record<string, string>)["Authorization"] = `Bearer ${apiKey}`;
      } else {
        throw new Error("Auth required: Run `feishu-md-export auth login openai` or set OPENAI_API_KEY env var");
      }
    }

    const response = await fetch(`${this.baseUrl}/responses`, requestOptions);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `openai caption failed: http=${response.status} model=${this.model} body=${body.slice(0, 500)}`,
      );
    }

    const payload = (await response.json()) as { output_text?: string };
    const raw = (payload.output_text ?? "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0 || end <= start) {
      throw new Error(`openai caption parse failed: non-json output (${raw.slice(0, 200)})`);
    }
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return CaptionSchema.parse(parsed);
  }
}

function extractNearbyContext(markdown: string, start: number, end: number): string {
  const before = markdown.slice(Math.max(0, start - 220), start);
  const after = markdown.slice(end, Math.min(markdown.length, end + 220));
  return `${before}\n${after}`.replace(/```image-digest[\s\S]*?```/g, "").trim();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDigest(assetId: string, digest: ImageCaption): string {
  const keyPoints = digest.key_points.map((point) => `  - "${point}"`).join("\n");
  const needs = digest.need_open_image_when.map((item) => `  - "${item}"`).join("\n");
  return [
    "```image-digest",
    `id: ${assetId}`,
    `role: ${digest.role}`,
    `summary: "${digest.summary.replaceAll('"', '\\"')}"`,
    "key_points:",
    keyPoints || "  - \"\"",
    "need_open_image_when:",
    needs || "  - \"\"",
    `confidence: ${digest.confidence.toFixed(2)}`,
    "```",
  ].join("\n");
}

function buildCaptioner(params: {
  provider?: "openai" | "mock";
  model?: string;
}): ImageCaptioner {
  const provider = params.provider ?? "openai";
  if (provider === "mock") {
    return new MockImageCaptioner();
  }
  return new OpenAIImageCaptioner({
    model: params.model ?? process.env.OPENAI_MODEL ?? "gpt-5.2",
    baseUrl: process.env.OPENAI_BASE_URL,
  });
}

export async function digestImages(params: {
  docAstPath: string;
  markdownPath: string;
  assetsDir: string;
  provider?: "openai" | "mock";
  model?: string;
  captioner?: ImageCaptioner;
  fallbackToMockOnError?: boolean;
  concurrency?: number;
}): Promise<void> {
  const [docAstRaw, markdownRaw] = await Promise.all([
    readFile(params.docAstPath, "utf8"),
    readFile(params.markdownPath, "utf8"),
  ]);
  const docAst = DocAstSchema.parse(JSON.parse(docAstRaw));
  const fallbackToMockOnError = params.fallbackToMockOnError ?? true;
  const envConcurrency = Number.parseInt(process.env.DIGEST_CONCURRENCY ?? "3", 10);
  const concurrency = params.concurrency ?? (Number.isFinite(envConcurrency) ? envConcurrency : 3);
  const fallbackCaptioner = new MockImageCaptioner();

  // Note: captioner can be injected/overridden for testing
  const captioner =
    params.captioner ?? buildCaptioner({ provider: params.provider, model: params.model });

  const tasks: Array<{
    assetId: string;
    imagePath: string;
    start: number;
    end: number;
    replacement?: string;
  }> = [];

  for (const block of docAst.doc.blocks) {
    if (block.type !== "image") {
      continue;
    }
    const asset = docAst.doc.assets[block.asset_id];
    if (!asset) {
      continue;
    }
    const imagePath = path.join(params.assetsDir, path.basename(asset.filename));
    const pattern = new RegExp(
      "```image-digest\\nid: " + escapeRegex(block.asset_id) + "[\\s\\S]*?```",
      "g",
    );
    const match = pattern.exec(markdownRaw);
    if (!match) {
      continue;
    }
    tasks.push({
      assetId: block.asset_id,
      imagePath,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      const index = cursor++;
      const task = tasks[index];
      const context = extractNearbyContext(markdownRaw, task.start, task.end);
      let digest: ImageCaption;
      try {
        digest = await captioner.caption({
          imagePath: task.imagePath,
          nearbyContext: context,
          assetId: task.assetId,
        });
      } catch (error) {
        if (!fallbackToMockOnError) {
          throw error;
        }
        // eslint-disable-next-line no-console
        console.warn(
          `Caption failed for asset ${task.assetId}, falling back to mock: ${String(error)}`,
        );
        digest = await fallbackCaptioner.caption({
          imagePath: task.imagePath,
          nearbyContext: context,
          assetId: task.assetId,
        });
      }
      task.replacement = formatDigest(task.assetId, digest);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  let markdown = markdownRaw;
  const ordered = tasks.slice().sort((a, b) => b.start - a.start);
  for (const task of ordered) {
    if (!task.replacement) {
      continue;
    }
    markdown = `${markdown.slice(0, task.start)}${task.replacement}${markdown.slice(task.end)}`;
  }

  await writeFile(params.markdownPath, markdown, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Updated image digest blocks in ${params.markdownPath}`);
}
