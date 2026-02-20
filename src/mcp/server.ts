import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exportDoc } from "../core/export-doc.js";
import { exportWiki } from "../core/export-wiki.js";
import { digestImages } from "../core/digest-images.js";
import path from "node:path";

const server = new McpServer({
    name: "feishu-mcp-md",
    version: "0.1.0",
});

// ---------- Tool 1: export_feishu_doc ----------
server.tool(
    "export_feishu_doc",
    "将一篇飞书文档（Docs）导出为 Markdown + DocAST(JSON) + assets。输入飞书文档 URL 或 doc token，输出到指定目录。",
    {
        doc_url_or_id: z
            .string()
            .describe("飞书文档 URL 或 doc token，例如 https://xxx.feishu.cn/docx/AbCdEf 或 AbCdEf"),
        output_dir: z
            .string()
            .describe("输出目录路径，导出结果将写入 <output_dir>/docs/<doc_id>/ 下"),
    },
    async ({ doc_url_or_id, output_dir }) => {
        try {
            await exportDoc({
                docInput: doc_url_or_id,
                outDir: path.resolve(output_dir),
            });
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `✅ 文档导出成功！输出目录: ${path.resolve(output_dir)}`,
                    },
                ],
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text" as const, text: `❌ 导出失败: ${msg}` }],
                isError: true,
            };
        }
    },
);

// ---------- Tool 2: export_feishu_wiki ----------
server.tool(
    "export_feishu_wiki",
    "将飞书知识库（Wiki）节点导出为 Markdown + DocAST(JSON) + assets。支持递归导出子节点。",
    {
        wiki_url_or_id: z
            .string()
            .describe("飞书 Wiki URL 或 wiki token"),
        output_dir: z
            .string()
            .describe("输出目录路径"),
        recursive: z
            .boolean()
            .default(true)
            .describe("是否递归导出子节点（默认 true）"),
        force: z
            .boolean()
            .default(false)
            .describe("是否强制重新导出已存在的文档（默认 false，跳过已导出的）"),
    },
    async ({ wiki_url_or_id, output_dir, recursive, force }) => {
        try {
            await exportWiki({
                wikiInput: wiki_url_or_id,
                outDir: path.resolve(output_dir),
                recursive,
                force,
            });
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `✅ Wiki 导出成功！输出目录: ${path.resolve(output_dir)}`,
                    },
                ],
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text" as const, text: `❌ Wiki 导出失败: ${msg}` }],
                isError: true,
            };
        }
    },
);

// ---------- Tool 3: digest_feishu_images ----------
server.tool(
    "digest_feishu_images",
    "为已导出的飞书文档中的图片生成 AI 摘要（image-digest）。需要先使用 export_feishu_doc 导出文档。",
    {
        docast_path: z
            .string()
            .describe("docast.json 文件路径"),
        md_path: z
            .string()
            .describe("index.md 文件路径"),
        assets_dir: z
            .string()
            .describe("assets/images 目录路径"),
        provider: z
            .enum(["openai", "mock"])
            .default("openai")
            .describe("摘要生成器：openai（需要 OPENAI_API_KEY）或 mock（测试用）"),
        model: z
            .string()
            .default("gpt-5.2")
            .describe("OpenAI 模型名称（默认 gpt-5.2）"),
        concurrency: z
            .number()
            .int()
            .min(1)
            .max(10)
            .default(3)
            .describe("并行处理图片数（默认 3）"),
    },
    async ({ docast_path, md_path, assets_dir, provider, model, concurrency }) => {
        try {
            await digestImages({
                docAstPath: path.resolve(docast_path),
                markdownPath: path.resolve(md_path),
                assetsDir: path.resolve(assets_dir),
                provider,
                model,
                concurrency,
            });
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `✅ 图片摘要生成完成！已更新 ${path.resolve(md_path)}`,
                    },
                ],
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text" as const, text: `❌ 图片摘要失败: ${msg}` }],
                isError: true,
            };
        }
    },
);

// ---------- Start server ----------
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err: unknown) => {
    console.error("MCP Server failed to start:", err);
    process.exit(1);
});
