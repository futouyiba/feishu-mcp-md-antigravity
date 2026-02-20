import { DocAst, DocBlock, ListItem, TextRun } from "../types/docast.js";

function renderTextRuns(textRuns: TextRun[]): string {
  return textRuns
    .map((run) => {
      let text = run.text;
      const marks = run.marks;
      if (!marks) {
        return text;
      }
      if (marks.code) {
        text = `\`${text}\``;
      }
      if (marks.bold) {
        text = `**${text}**`;
      }
      if (marks.italic) {
        text = `*${text}*`;
      }
      if (marks.strike) {
        text = `~~${text}~~`;
      }
      if (marks.link) {
        text = `[${text}](${marks.link})`;
      }
      return text;
    })
    .join("");
}

function renderListItems(items: ListItem[], ordered: boolean, depth = 0): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  for (const item of items) {
    const prefix = item.ordered ?? ordered ? "1." : "-";
    lines.push(`${indent}${prefix} ${renderTextRuns(item.text_runs)}`);
    if (item.children && item.children.length > 0) {
      lines.push(...renderListItems(item.children as ListItem[], item.ordered, depth + 1));
    }
  }
  return lines;
}

function renderTable(rows: string[][]): string[] {
  if (rows.length === 0) {
    return ["| (empty table) |", "| --- |"];
  }
  const header = rows[0];
  const body = rows.slice(1);
  const lines = [
    `| ${header.map((c) => c.replaceAll("|", "\\|")).join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
  ];
  for (const row of body) {
    lines.push(`| ${row.map((c) => c.replaceAll("|", "\\|")).join(" | ")} |`);
  }
  return lines;
}

function renderImageBlock(docAst: DocAst, block: Extract<DocBlock, { type: "image" }>): string[] {
  const asset = docAst.doc.assets[block.asset_id];
  const alt = renderTextRuns(block.caption_runs).trim() || `image-${block.asset_id}`;
  const path = asset?.filename ?? `assets/images/${block.asset_id}.bin`;
  return [
    `![${alt}](${path})`,
    "",
    "```image-digest",
    `id: ${block.asset_id}`,
    "role: unknown",
    'summary: "TODO: fill image summary"',
    "key_points: []",
    "need_open_image_when: []",
    "confidence: 0.0",
    "```",
  ];
}

function renderBlock(docAst: DocAst, block: DocBlock): string[] {
  if (block.type === "heading") {
    return [`${"#".repeat(block.level)} ${renderTextRuns(block.text_runs)}`];
  }
  if (block.type === "paragraph") {
    return [renderTextRuns(block.text_runs)];
  }
  if (block.type === "quote") {
    return [`> ${renderTextRuns(block.text_runs)}`];
  }
  if (block.type === "callout") {
    return [`> [!NOTE]`, `> ${renderTextRuns(block.text_runs)}`];
  }
  if (block.type === "code") {
    const lang = block.language ?? "";
    return ["```" + lang, renderTextRuns(block.text_runs), "```"];
  }
  if (block.type === "divider") {
    return ["---"];
  }
  if (block.type === "list") {
    return renderListItems(block.items, block.ordered);
  }
  if (block.type === "todo") {
    const check = block.checked ? "x" : " ";
    return [`- [${check}] ${renderTextRuns(block.text_runs)}`];
  }
  if (block.type === "image") {
    return renderImageBlock(docAst, block);
  }
  if (block.type === "table") {
    const lines = renderTable(block.rows);
    if (block.truncated) {
      lines.push("");
      const omitted = block.omitted_rows ?? 0;
      lines.push(
        `> Table preview truncated${omitted > 0 ? `, omitted ${omitted} rows` : ""}. See CSV in assets/tables.`,
      );
    }
    return lines;
  }
  return [`<!-- unsupported block type: ${block.raw_type} -->`];
}

export function renderMarkdown(docAst: DocAst): string {
  const lines: string[] = [];
  lines.push(`# ${docAst.doc.title.replaceAll("|", "\\|")}`);
  lines.push("");
  for (const block of docAst.doc.blocks) {
    lines.push(...renderBlock(docAst, block));
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
