# feishu-md-export

CLI tool to export Feishu/Lark Docs to `DocAST(JSON) + Markdown + assets`.

## Requirements
- Node.js >= 18
- Feishu app credentials with doc read permission

## Install
```bash
npm install
```

## Environment Variables
- `FEISHU_APP_ID` (required)
- `FEISHU_APP_SECRET` (required)
- `FEISHU_BASE_URL` (optional, default: `https://open.larkoffice.com`)
- `TABLE_PREVIEW_MAX_ROWS` (optional, default: `30`, controls Markdown table preview rows)
- `OPENAI_API_KEY` (required for `digest-images` with `--provider openai`)
- `OPENAI_MODEL` (optional, default: `gpt-5.2`)
- `OPENAI_BASE_URL` (optional, default: `https://api.openai.com/v1`)
- `DIGEST_CONCURRENCY` (optional, default: `3`)

## Usage
Export one doc by URL or token:
```bash
npm run dev -- export-doc --doc https://xxx.feishu.cn/docx/AbCdEf123456 --out ./output
```

Or:
```bash
npm run dev -- export-doc --doc AbCdEf123456 --out ./output
```

Export wiki root node:
```bash
npm run dev -- export-wiki --wiki https://xxx.feishu.cn/wiki/AbCdEf123456 --out ./output --recursive
```
By default, existing exported docs are skipped for resumable runs. Use `--force` to overwrite.

Fill image digest blocks with mock captions:
```bash
npm run dev -- digest-images --docast ./output/docs/<doc_id>/docast.json --md ./output/docs/<doc_id>/index.md --assets ./output/docs/<doc_id>/assets/images --provider openai --model gpt-5.2
```

Use `--provider mock` to run without external model calls.
By default, `digest-images` falls back to mock captions if OpenAI fails for an image. Use `--no-fallback-mock` to fail fast.
Use `--concurrency <n>` to process multiple images in parallel.

## Output
For each document:
```text
output/
  docs/<doc_id>/
    index.md
    docast.json
    sources.json
    assets/
      images/
      tables/
```

## Current MVP Status
- Implemented:
  - token fetch/cache
  - doc metadata + block fetch
  - DocAST generation (heading/paragraph/list/quote/code/divider/todo/image/table/unknown)
  - Markdown rendering with nested list preservation, image blocks, and image-digest placeholder fence
  - image asset download to `assets/images`
  - image extension detection from response headers/file signatures (`.png/.jpg/.webp/.gif/.svg`)
  - table CSV export to `assets/tables` and source metadata in `sources.json`
  - markdown table preview truncation with full CSV retention
  - wiki export (`export-wiki`) with optional recursive traversal
  - unit tests for nested/mixed lists and rich block rendering
- Not yet implemented:
  - stronger JSON-structured response enforcement for model output (currently robust parser + schema validation)
