import { z } from "zod";

export const TextRunSchema = z.object({
  text: z.string(),
  marks: z
    .object({
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      strike: z.boolean().optional(),
      code: z.boolean().optional(),
      link: z.string().optional(),
    })
    .optional(),
});

const ListItemSchema: z.ZodType<{
  id: string;
  text_runs: Array<z.infer<typeof TextRunSchema>>;
  ordered: boolean;
  children?: unknown[];
}> = z.lazy(() =>
  z.object({
    id: z.string(),
    text_runs: z.array(TextRunSchema),
    ordered: z.boolean(),
    children: z.array(ListItemSchema).optional(),
  }),
);

const CommonSchema = z.object({
  id: z.string(),
});

const ParagraphSchema = CommonSchema.extend({
  type: z.literal("paragraph"),
  text_runs: z.array(TextRunSchema),
});

const HeadingSchema = CommonSchema.extend({
  type: z.literal("heading"),
  level: z.number().int().min(1).max(6),
  text_runs: z.array(TextRunSchema),
});

const QuoteSchema = CommonSchema.extend({
  type: z.literal("quote"),
  text_runs: z.array(TextRunSchema),
});

const CalloutSchema = CommonSchema.extend({
  type: z.literal("callout"),
  text_runs: z.array(TextRunSchema),
});

const CodeSchema = CommonSchema.extend({
  type: z.literal("code"),
  language: z.string().optional(),
  text_runs: z.array(TextRunSchema),
});

const DividerSchema = CommonSchema.extend({
  type: z.literal("divider"),
});

const ListSchema = CommonSchema.extend({
  type: z.literal("list"),
  ordered: z.boolean(),
  items: z.array(ListItemSchema),
});

const TodoSchema = CommonSchema.extend({
  type: z.literal("todo"),
  checked: z.boolean(),
  text_runs: z.array(TextRunSchema),
});

const ImageSchema = CommonSchema.extend({
  type: z.literal("image"),
  asset_id: z.string(),
  caption_runs: z.array(TextRunSchema).default([]),
});

const TableSchema = CommonSchema.extend({
  type: z.literal("table"),
  rows: z.array(z.array(z.string())),
  truncated: z.boolean().optional(),
  omitted_rows: z.number().int().min(0).optional(),
});

const UnknownSchema = CommonSchema.extend({
  type: z.literal("unknown"),
  raw_type: z.number(),
});

export const DocBlockSchema = z.discriminatedUnion("type", [
  ParagraphSchema,
  HeadingSchema,
  QuoteSchema,
  CalloutSchema,
  CodeSchema,
  DividerSchema,
  ListSchema,
  TodoSchema,
  ImageSchema,
  TableSchema,
  UnknownSchema,
]);

const AssetSchema = z.object({
  id: z.string(),
  kind: z.enum(["image"]),
  token: z.string(),
  filename: z.string(),
  mime: z.string().optional(),
  source_block_id: z.string(),
});

export const DocAstSchema = z.object({
  doc: z.object({
    doc_id: z.string(),
    title: z.string(),
    source: z.object({
      type: z.literal("feishu_doc"),
      url: z.string(),
    }),
    blocks: z.array(DocBlockSchema),
    assets: z.record(z.string(), AssetSchema),
  }),
});

export type TextRun = z.infer<typeof TextRunSchema>;
export type ListItem = z.infer<typeof ListItemSchema>;
export type DocBlock = z.infer<typeof DocBlockSchema>;
export type DocAst = z.infer<typeof DocAstSchema>;
export type Asset = z.infer<typeof AssetSchema>;
