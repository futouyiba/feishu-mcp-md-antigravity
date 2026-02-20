import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppConfig, loadConfig } from "./config.js";
import { parseDocId } from "./parse-doc-id.js";
import { getTenantAccessToken } from "../feishu/auth.js";
import { downloadMedia, getDocument, listAllBlocks } from "../feishu/api.js";
import { toDocAst } from "./to-docast.js";
import { DocAst, DocAstSchema } from "../types/docast.js";
import { renderMarkdown } from "../render/markdown.js";

type SourceEntry = {
  type: "table";
  doc_id: string;
  block_id: string;
  csv: string;
  row_count: number;
  preview_row_count: number;
  col_count: number;
  truncated: boolean;
};

function getTablePreviewMaxRows(): number {
  const raw = process.env.TABLE_PREVIEW_MAX_ROWS;
  if (!raw) {
    return 30;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    return 30;
  }
  return value;
}

function tableToCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const escaped = cell.replaceAll('"', '""');
          return `"${escaped}"`;
        })
        .join(","),
    )
    .join("\n");
}

async function exportTables(
  outputRoot: string,
  docAst: DocAst,
  markdownPreviewDocAst: DocAst,
): Promise<{
  docAst: DocAst;
  sources: SourceEntry[];
}> {
  const previewById = new Map(
    markdownPreviewDocAst.doc.blocks
      .filter((block) => block.type === "table")
      .map((block) => [block.id, block]),
  );
  const sources: SourceEntry[] = [];
  for (const block of docAst.doc.blocks) {
    if (block.type !== "table") {
      continue;
    }
    const previewBlock = previewById.get(block.id);
    const previewRows = previewBlock && previewBlock.type === "table" ? previewBlock.rows.length : 0;
    const fileName = `table-${block.id}.csv`;
    const filePath = path.join(outputRoot, "assets", "tables", fileName);
    await writeFile(filePath, `${tableToCsv(block.rows)}\n`, "utf8");

    sources.push({
      type: "table",
      doc_id: docAst.doc.doc_id,
      block_id: block.id,
      csv: `assets/tables/${fileName}`,
      row_count: block.rows.length,
      preview_row_count: previewRows,
      col_count: block.rows[0]?.length ?? 0,
      truncated: Boolean(previewBlock && previewBlock.type === "table" && previewBlock.truncated),
    });
  }
  return { docAst, sources };
}

function extFromMime(contentType?: string): string | null {
  if (!contentType) return null;
  const mime = contentType.toLowerCase().split(";")[0].trim();
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/svg+xml") return ".svg";
  return null;
}

function extFromMagic(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return ".png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return ".jpg";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return ".webp";
  }
  if (buffer.length >= 6) {
    const sig = buffer.subarray(0, 6).toString("ascii");
    if (sig === "GIF87a" || sig === "GIF89a") {
      return ".gif";
    }
  }
  if (buffer.length >= 5) {
    const head = buffer.subarray(0, 200).toString("utf8").trimStart();
    if (head.startsWith("<?xml") || head.startsWith("<svg")) {
      return ".svg";
    }
  }
  return null;
}

function toPosixPath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

async function downloadAssets(
  outputRoot: string,
  docAst: DocAst,
  download: (token: string) => Promise<{ data: ArrayBuffer; contentType?: string }>,
): Promise<DocAst> {
  for (const asset of Object.values(docAst.doc.assets)) {
    if (asset.kind !== "image") {
      continue;
    }
    try {
      const { data, contentType } = await download(asset.token);
      const buffer = Buffer.from(data);
      const inferredExt =
        extFromMime(contentType) ?? extFromMagic(buffer) ?? path.extname(asset.filename);
      const ext = inferredExt || ".bin";
      const baseName = path.basename(asset.filename, path.extname(asset.filename));
      const relativePath = toPosixPath(path.join("assets", "images", `${baseName}${ext}`));
      const fullPath = path.join(outputRoot, relativePath);
      await writeFile(fullPath, buffer);
      asset.filename = relativePath;
      if (contentType) {
        asset.mime = contentType;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`Failed to download image asset ${asset.id}: ${String(error)}`);
    }
  }
  return docAst;
}

function buildMarkdownPreviewDocAst(docAst: DocAst, maxDataRows: number): DocAst {
  const preview = structuredClone(docAst);
  for (const block of preview.doc.blocks) {
    if (block.type !== "table") {
      continue;
    }
    if (block.rows.length <= 1 + maxDataRows) {
      continue;
    }
    const header = block.rows[0] ?? [];
    const body = block.rows.slice(1, 1 + maxDataRows);
    const omittedRows = Math.max(0, block.rows.length - 1 - body.length);
    block.rows = [header, ...body];
    block.truncated = true;
    block.omitted_rows = omittedRows;
  }
  return preview;
}

export async function exportDoc(params: {
  docInput: string;
  outDir: string;
  config?: AppConfig;
  accessToken?: string;
}): Promise<void> {
  const config = params.config ?? loadConfig();
  const docId = parseDocId(params.docInput);
  const token = params.accessToken ?? (await getTenantAccessToken(config));
  const document = await getDocument(config, token, docId);
  const blocks = await listAllBlocks(config, token, docId);

  const sourceUrl = params.docInput.startsWith("http")
    ? params.docInput
    : `https://open.larkoffice.com/document/server-docs/docs/docs/docx-v1/document/get?document_id=${docId}`;

  const initial = toDocAst({
    docId,
    title: document.title,
    sourceUrl,
    blocks,
  });

  const outputRoot = path.join(params.outDir, "docs", docId);
  await mkdir(path.join(outputRoot, "assets", "images"), { recursive: true });
  await mkdir(path.join(outputRoot, "assets", "tables"), { recursive: true });

  const withAssets = await downloadAssets(outputRoot, initial, async (fileToken) =>
    downloadMedia(config, token, fileToken),
  );
  const markdownPreviewDocAst = buildMarkdownPreviewDocAst(withAssets, getTablePreviewMaxRows());
  const { docAst, sources } = await exportTables(outputRoot, withAssets, markdownPreviewDocAst);
  const validated = DocAstSchema.parse(docAst);
  const markdown = renderMarkdown(markdownPreviewDocAst);

  await writeFile(
    path.join(outputRoot, "docast.json"),
    `${JSON.stringify(validated, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(outputRoot, "index.md"), markdown, "utf8");
  await writeFile(
    path.join(outputRoot, "sources.json"),
    `${JSON.stringify({ generated_at: new Date().toISOString(), items: sources }, null, 2)}\n`,
    "utf8",
  );

  // eslint-disable-next-line no-console
  console.log(`Exported doc ${docId} -> ${outputRoot}`);
}
