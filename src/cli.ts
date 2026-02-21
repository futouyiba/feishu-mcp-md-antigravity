#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { exportDoc } from "./core/export-doc.js";
import { exportWiki } from "./core/export-wiki.js";
import { digestImages } from "./core/digest-images.js";
import { authService } from "./auth/index.js";

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

const authCmd = program.command("auth").description("Manage OAuth connections for AI providers");

authCmd
  .command("login <provider>")
  .description("Authenticate with a provider (e.g. openai, google)")
  .action(async (provider) => {
    await authService.connect(String(provider));
  });

authCmd
  .command("logout <provider>")
  .description("Remove authentication for a provider")
  .action(async (provider) => {
    await authService.disconnect(String(provider));
  });

authCmd
  .command("list")
  .description("List active authenticated providers")
  .action(async () => {
    const list = await authService.listConnections();
    if (list.length === 0) {
      // eslint-disable-next-line no-console
      console.log("No active connections.");
    } else {
      // eslint-disable-next-line no-console
      console.log("Active connections:");
      for (const conn of list) {
        // eslint-disable-next-line no-console
        console.log(`- ${conn.provider} (expires: ${new Date(conn.expiresAt).toLocaleString()})`);
      }
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error(`[error] ${message}`);
  process.exitCode = 1;
});
