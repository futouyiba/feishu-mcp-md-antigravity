import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { digestImages } from "../src/core/digest-images.js";

describe("digestImages", () => {
  it("replaces placeholder digest block", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "digest-images-"));
    const docAstPath = path.join(dir, "docast.json");
    const mdPath = path.join(dir, "index.md");
    const assetsDir = path.join(dir, "assets", "images");

    await writeFile(
      docAstPath,
      JSON.stringify({
        doc: {
          doc_id: "d1",
          title: "T",
          source: { type: "feishu_doc", url: "https://example.com" },
          assets: {
            img1: {
              id: "img1",
              kind: "image",
              token: "img1",
              filename: "assets/images/img1.bin",
              source_block_id: "b1",
            },
          },
          blocks: [
            {
              id: "b1",
              type: "image",
              asset_id: "img1",
              caption_runs: [],
            },
          ],
        },
      }),
      "utf8",
    );

    await writeFile(
      mdPath,
      [
        "![img](assets/images/img1.bin)",
        "",
        "```image-digest",
        "id: img1",
        "role: unknown",
        'summary: "TODO: fill image summary"',
        "key_points: []",
        "need_open_image_when: []",
        "confidence: 0.0",
        "```",
        "",
      ].join("\n"),
      "utf8",
    );

    await digestImages({
      docAstPath,
      markdownPath: mdPath,
      assetsDir,
      provider: "mock",
    });

    const updated = await readFile(mdPath, "utf8");
    expect(updated).toContain("Image img1");
    expect(updated).toContain("confidence: 0.35");
    expect(updated).not.toContain("TODO: fill image summary");
  });

  it("falls back to mock captioner when provider fails", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "digest-images-fallback-"));
    const docAstPath = path.join(dir, "docast.json");
    const mdPath = path.join(dir, "index.md");
    const assetsDir = path.join(dir, "assets", "images");

    await writeFile(
      docAstPath,
      JSON.stringify({
        doc: {
          doc_id: "d1",
          title: "T",
          source: { type: "feishu_doc", url: "https://example.com" },
          assets: {
            img1: {
              id: "img1",
              kind: "image",
              token: "img1",
              filename: "assets/images/img1.bin",
              source_block_id: "b1",
            },
          },
          blocks: [
            {
              id: "b1",
              type: "image",
              asset_id: "img1",
              caption_runs: [],
            },
          ],
        },
      }),
      "utf8",
    );

    await writeFile(
      mdPath,
      [
        "![img](assets/images/img1.bin)",
        "",
        "```image-digest",
        "id: img1",
        "role: unknown",
        'summary: "TODO: fill image summary"',
        "key_points: []",
        "need_open_image_when: []",
        "confidence: 0.0",
        "```",
        "",
      ].join("\n"),
      "utf8",
    );

    await digestImages({
      docAstPath,
      markdownPath: mdPath,
      assetsDir,
      captioner: {
        caption: async () => {
          throw new Error("simulated provider failure");
        },
      },
      fallbackToMockOnError: true,
    });

    const updated = await readFile(mdPath, "utf8");
    expect(updated).toContain("Replace with multimodal model output in production.");
    expect(updated).toContain("confidence: 0.35");
  });
});
