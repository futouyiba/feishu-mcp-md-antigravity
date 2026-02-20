import { describe, expect, it } from "vitest";
import { parseDocId } from "../src/core/parse-doc-id.js";
import { parseWikiToken } from "../src/core/parse-wiki-token.js";

describe("input parsers", () => {
  it("parses doc token from url and raw token", () => {
    expect(parseDocId("AbCdEF123")).toBe("AbCdEF123");
    expect(parseDocId("https://sample.feishu.cn/docx/AbCdEF123?from=share")).toBe(
      "AbCdEF123",
    );
  });

  it("parses wiki token from url and raw token", () => {
    expect(parseWikiToken("WikiToken123")).toBe("WikiToken123");
    expect(parseWikiToken("https://sample.feishu.cn/wiki/WikiToken123?from=share")).toBe(
      "WikiToken123",
    );
  });
});
