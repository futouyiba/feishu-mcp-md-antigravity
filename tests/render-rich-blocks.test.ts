import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/render/markdown.js";
import { DocAst } from "../src/types/docast.js";

describe("renderMarkdown rich blocks", () => {
  it("renders image with digest fence and table", () => {
    const doc: DocAst = {
      doc: {
        doc_id: "d2",
        title: "Rich",
        source: { type: "feishu_doc", url: "https://example.com" },
        assets: {
          img_a: {
            id: "img_a",
            kind: "image",
            token: "img_a",
            filename: "assets/images/img_a.bin",
            source_block_id: "bimg",
          },
        },
        blocks: [
          {
            id: "bimg",
            type: "image",
            asset_id: "img_a",
            caption_runs: [{ text: "diagram" }],
          },
          {
            id: "bt",
            type: "table",
            rows: [
              ["k", "v"],
              ["a", "1"],
            ],
            truncated: true,
            omitted_rows: 12,
          },
        ],
      },
    };

    const md = renderMarkdown(doc);
    expect(md).toContain("![diagram](assets/images/img_a.bin)");
    expect(md).toContain("```image-digest");
    expect(md).toContain("| k | v |");
    expect(md).toContain("| a | 1 |");
    expect(md).toContain("Table preview truncated, omitted 12 rows");
  });

  it("renders mixed nested list markers", () => {
    const doc: DocAst = {
      doc: {
        doc_id: "d3",
        title: "Mixed List",
        source: { type: "feishu_doc", url: "https://example.com" },
        assets: {},
        blocks: [
          {
            id: "l1",
            type: "list",
            ordered: false,
            items: [
              {
                id: "i1",
                ordered: false,
                text_runs: [{ text: "parent" }],
                children: [
                  {
                    id: "i1-1",
                    ordered: true,
                    text_runs: [{ text: "child ordered" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const md = renderMarkdown(doc);
    expect(md).toContain("- parent");
    expect(md).toContain("  1. child ordered");
  });
});
