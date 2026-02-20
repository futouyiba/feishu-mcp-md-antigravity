#!/usr/bin/env node
import { Command } from "commander";
import { exportDoc } from "./core/export-doc.js";
import { exportWiki } from "./core/export-wiki.js";
import { digestImages } from "./core/digest-images.js";

const program = new Command();

program
  .name("feishu-md-export")
  .description("Export Feishu/Lark Docs to DocAST + Markdown + assets")
  .version("0.1.0");

program
  .command("export-doc")
  .requiredOption("--doc <doc_url_or_id>", "Doc URL or doc token")
  .requiredOption("--out <dir>", "Output directory")
  .action(async (options) => {
    await exportDoc({
      docInput: String(options.doc),
      outDir: String(options.out),
    });
  });

program
  .command("export-wiki")
  .requiredOption("--wiki <wiki_url_or_id>", "Wiki URL or wiki token")
  .requiredOption("--out <dir>", "Output directory")
  .option("--recursive", "Export descendants recursively", false)
  .option("--force", "Re-export docs even if output already exists", false)
  .action(async (options) => {
    await exportWiki({
      wikiInput: String(options.wiki),
      outDir: String(options.out),
      recursive: Boolean(options.recursive),
      force: Boolean(options.force),
    });
  });

program
  .command("digest-images")
  .requiredOption("--docast <path>", "Path to docast.json")
  .requiredOption("--md <path>", "Path to index.md")
  .requiredOption("--assets <dir>", "Path to assets/images directory")
  .option("--provider <provider>", "Caption provider: openai | mock", "openai")
  .option("--model <model>", "Model name for OpenAI provider", "gpt-5.2")
  .option("--concurrency <n>", "Parallel image caption tasks", "3")
  .option("--no-fallback-mock", "Disable fallback to mock captioner when provider fails")
  .action(async (options) => {
    await digestImages({
      docAstPath: String(options.docast),
      markdownPath: String(options.md),
      assetsDir: String(options.assets),
      provider: String(options.provider) as "openai" | "mock",
      model: String(options.model),
      concurrency: Number.parseInt(String(options.concurrency), 10),
      fallbackToMockOnError: Boolean(options.fallbackMock),
    });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error(`[error] ${message}`);
  process.exitCode = 1;
});
