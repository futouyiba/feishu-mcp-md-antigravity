import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/render/markdown.js";
import { DocAst } from "../src/types/docast.js";

describe("renderMarkdown list nesting", () => {
  it("keeps nested list indentation", () => {
    const doc: DocAst = {
      doc: {
        doc_id: "d1",
        title: "List Test",
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
                    ordered: false,
                    text_runs: [{ text: "child" }],
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
    expect(md).toContain("  - child");
  });
});
