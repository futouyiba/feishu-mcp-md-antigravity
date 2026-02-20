import { Block } from "../feishu/api.js";
import { Asset, DocAst, TextRun } from "../types/docast.js";

const BLOCK = {
  PAGE: 1,
  PARAGRAPH: 2,
  HEADING1: 3,
  HEADING2: 4,
  HEADING3: 5,
  HEADING4: 6,
  HEADING5: 7,
  HEADING6: 8,
  HEADING7: 9,
  HEADING8: 10,
  HEADING9: 11,
  BULLET: 12,
  ORDERED: 13,
  CODE: 14,
  QUOTE: 15,
  TODO: 17,
  CALLOUT: 19,
  DIVIDER: 22,
  IMAGE: 27,
  TABLE: 31,
  TABLE_CELL: 32,
} as const;

const headingLevelByType: Record<number, number> = {
  [BLOCK.HEADING1]: 1,
  [BLOCK.HEADING2]: 2,
  [BLOCK.HEADING3]: 3,
  [BLOCK.HEADING4]: 4,
  [BLOCK.HEADING5]: 5,
  [BLOCK.HEADING6]: 6,
  [BLOCK.HEADING7]: 6,
  [BLOCK.HEADING8]: 6,
  [BLOCK.HEADING9]: 6,
};

function normalizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function toTextRuns(block: Block): TextRun[] {
  const container =
    block.text ??
    block.heading1 ??
    block.heading2 ??
    block.heading3 ??
    block.heading4 ??
    block.heading5 ??
    block.heading6 ??
    block.bullet ??
    block.ordered ??
    block.quote ??
    block.callout ??
    (block.todo ? { elements: block.todo.elements } : undefined) ??
    (block.table_cell ? { elements: block.table_cell.elements } : undefined) ??
    (block.code ? { elements: block.code.elements } : undefined);

  const elements = container?.elements ?? [];
  return elements.map((item: NonNullable<typeof elements>[number]) => {
    const text =
      item.text_run?.content ??
      item.equation?.content ??
      item.reminder?.mention?.title ??
      item.person?.name ??
      "";
    const hasStyle = Boolean(item.text_element_style);
    const marks = hasStyle
      ? {
          bold: item.text_element_style?.bold,
          italic: item.text_element_style?.italic,
          strike: item.text_element_style?.strikethrough,
          code: item.text_element_style?.inline_code,
          link: item.docs_link?.url,
        }
      : item.docs_link?.url
        ? { link: item.docs_link.url }
        : undefined;
    return { text, marks };
  });
}

type ListNode = {
  id: string;
  ordered: boolean;
  text_runs: TextRun[];
  children: ListNode[];
};

function collectListNode(
  block: Block,
  blockById: Map<string, Block>,
  visiting = new Set<string>(),
): ListNode {
  if (visiting.has(block.block_id)) {
    return {
      id: block.block_id,
      ordered: block.block_type === BLOCK.ORDERED,
      text_runs: toTextRuns(block),
      children: [],
    };
  }
  visiting.add(block.block_id);

  const children: ListNode[] = [];
  for (const childId of block.children ?? []) {
    const child = blockById.get(childId);
    if (!child) {
      continue;
    }
    if (child.block_type !== BLOCK.BULLET && child.block_type !== BLOCK.ORDERED) {
      continue;
    }
    children.push(collectListNode(child, blockById, visiting));
  }
  visiting.delete(block.block_id);

  return {
    id: block.block_id,
    ordered: block.block_type === BLOCK.ORDERED,
    text_runs: toTextRuns(block),
    children,
  };
}

function flattenTextRuns(runs: TextRun[]): string {
  return runs.map((run) => run.text).join("").trim();
}

function collectPlainText(
  blockId: string,
  blockById: Map<string, Block>,
  visited = new Set<string>(),
): string {
  if (visited.has(blockId)) {
    return "";
  }
  visited.add(blockId);

  const block = blockById.get(blockId);
  if (!block) {
    return "";
  }

  const self = flattenTextRuns(toTextRuns(block));
  const childText = (block.children ?? [])
    .map((childId) => collectPlainText(childId, blockById, visited))
    .filter(Boolean)
    .join(" ");
  return [self, childText].filter(Boolean).join(" ").trim();
}

function extractTableRows(tableBlock: Block, blockById: Map<string, Block>): string[][] {
  if (tableBlock.table?.cells && tableBlock.table.cells.length > 0) {
    return tableBlock.table.cells.map((row) =>
      row.map((cellId) => collectPlainText(cellId, blockById)),
    );
  }

  const rows: string[][] = [];
  for (const rowId of tableBlock.children ?? []) {
    const rowBlock = blockById.get(rowId);
    if (!rowBlock) {
      continue;
    }
    const cellIds = rowBlock.children ?? [];
    if (cellIds.length === 0) {
      continue;
    }
    rows.push(cellIds.map((cellId) => collectPlainText(cellId, blockById)));
  }
  return rows;
}

export function toDocAst(params: {
  docId: string;
  title: string;
  sourceUrl: string;
  blocks: Block[];
}): DocAst {
  const blockById = new Map<string, Block>(params.blocks.map((b) => [b.block_id, b]));
  const rootChildren = params.blocks
    .filter((b) => b.block_type === BLOCK.PAGE)
    .flatMap((b) => b.children ?? []);

  const astBlocks: DocAst["doc"]["blocks"] = [];
  const assets: Record<string, Asset> = {};

  for (const blockId of rootChildren) {
    const block = blockById.get(blockId);
    if (!block) {
      continue;
    }

    if (block.block_type === BLOCK.PARAGRAPH) {
      astBlocks.push({ id: block.block_id, type: "paragraph", text_runs: toTextRuns(block) });
      continue;
    }

    if (headingLevelByType[block.block_type]) {
      astBlocks.push({
        id: block.block_id,
        type: "heading",
        level: headingLevelByType[block.block_type],
        text_runs: toTextRuns(block),
      });
      continue;
    }

    if (block.block_type === BLOCK.BULLET || block.block_type === BLOCK.ORDERED) {
      const parent = blockById.get(block.parent_id);
      if (parent && (parent.block_type === BLOCK.BULLET || parent.block_type === BLOCK.ORDERED)) {
        continue;
      }
      astBlocks.push({
        id: block.block_id,
        type: "list",
        ordered: block.block_type === BLOCK.ORDERED,
        items: [collectListNode(block, blockById)],
      });
      continue;
    }

    if (block.block_type === BLOCK.QUOTE) {
      astBlocks.push({ id: block.block_id, type: "quote", text_runs: toTextRuns(block) });
      continue;
    }

    if (block.block_type === BLOCK.CALLOUT) {
      astBlocks.push({ id: block.block_id, type: "callout", text_runs: toTextRuns(block) });
      continue;
    }

    if (block.block_type === BLOCK.CODE) {
      astBlocks.push({
        id: block.block_id,
        type: "code",
        language: block.code?.language ? String(block.code.language) : undefined,
        text_runs: toTextRuns(block),
      });
      continue;
    }

    if (block.block_type === BLOCK.DIVIDER) {
      astBlocks.push({ id: block.block_id, type: "divider" });
      continue;
    }

    if (block.block_type === BLOCK.TODO) {
      astBlocks.push({
        id: block.block_id,
        type: "todo",
        checked: Boolean(block.todo?.style?.done),
        text_runs: toTextRuns(block),
      });
      continue;
    }

    if (block.block_type === BLOCK.IMAGE) {
      const token = block.image?.token ?? block.image?.file_token;
      if (!token) {
        astBlocks.push({ id: block.block_id, type: "unknown", raw_type: block.block_type });
        continue;
      }
      const assetId = token;
      const filename = `assets/images/${normalizeFileName(assetId)}.bin`;
      assets[assetId] = {
        id: assetId,
        kind: "image",
        token: assetId,
        filename,
        source_block_id: block.block_id,
      };
      astBlocks.push({
        id: block.block_id,
        type: "image",
        asset_id: assetId,
        caption_runs: block.image?.alt ? [{ text: block.image.alt }] : [],
      });
      continue;
    }

    if (block.block_type === BLOCK.TABLE) {
      astBlocks.push({
        id: block.block_id,
        type: "table",
        rows: extractTableRows(block, blockById),
      });
      continue;
    }

    astBlocks.push({ id: block.block_id, type: "unknown", raw_type: block.block_type });
  }

  return {
    doc: {
      doc_id: params.docId,
      title: params.title,
      source: { type: "feishu_doc", url: params.sourceUrl },
      blocks: astBlocks,
      assets,
    },
  };
}
