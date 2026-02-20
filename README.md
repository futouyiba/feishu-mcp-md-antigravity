# feishu-mcp-md-antigravity

MCP Server & CLI 工具：将飞书（Feishu/Lark）文档通过 MCP 协议导出为 `DocAST(JSON) + Markdown + assets`。

> Built with [Antigravity](https://antigravity.dev) editor

## 特色

- 🔌 **MCP Server** — AI Agent（Claude、Antigravity 等）可直接调用飞书文档导出能力
- 📄 **CLI 工具** — 也可作为独立命令行工具使用
- 🌳 **DocAST 中间层** — 保留完整语义层级（标题、列表嵌套、表格等），Markdown 只是 renderer
- 🖼️ **图片 AI 摘要** — 为文档图片生成结构化 digest，便于 Agent 快速理解图片内容

## 环境要求

- Node.js >= 18
- 飞书自建应用凭证（需文档读取权限）

## 安装

```bash
npm install
cp .env.example .env   # 编辑 .env 填入飞书凭证
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `FEISHU_APP_ID` | ✅ | 飞书应用 ID |
| `FEISHU_APP_SECRET` | ✅ | 飞书应用 Secret |
| `FEISHU_BASE_URL` | ❌ | 飞书 API 域名（默认 `https://open.larkoffice.com`） |
| `OPENAI_API_KEY` | ❌ | OpenAI API Key（digest-images 使用） |
| `OPENAI_MODEL` | ❌ | 模型名称（默认 `gpt-5.2`） |
| `OPENAI_BASE_URL` | ❌ | OpenAI 兼容 API 地址 |
| `TABLE_PREVIEW_MAX_ROWS` | ❌ | Markdown 表格预览行数（默认 30） |
| `DIGEST_CONCURRENCY` | ❌ | 图片摘要并发数（默认 3） |

## 使用方式

### 方式一：MCP Server（推荐）

在你的 AI 编辑器（Antigravity、Claude Desktop 等）的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "feishu-mcp-md": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "cwd": "/path/to/feishu-mcp-md-antigravity"
    }
  }
}
```

MCP Server 提供以下 tools：

| Tool | 说明 |
|------|------|
| `export_feishu_doc` | 导出单篇飞书文档 |
| `export_feishu_wiki` | 导出飞书知识库（支持递归） |
| `digest_feishu_images` | 为已导出文档的图片生成 AI 摘要 |

### 方式二：CLI

```bash
# 导出单篇文档
npm run dev -- export-doc --doc https://xxx.feishu.cn/docx/AbCdEf --out ./output

# 导出知识库（递归）
npm run dev -- export-wiki --wiki https://xxx.feishu.cn/wiki/AbCdEf --out ./output --recursive

# 图片摘要
npm run dev -- digest-images --docast ./output/docs/<doc_id>/docast.json \
  --md ./output/docs/<doc_id>/index.md \
  --assets ./output/docs/<doc_id>/assets/images \
  --provider openai
```

## 输出结构

```
output/
  docs/<doc_id>/
    index.md          # Markdown 正文
    docast.json       # 结构化 DocAST（Zod 校验）
    sources.json      # 表格来源追溯
    assets/
      images/         # 图片附件
      tables/         # 表格 CSV
```

## 开发

```bash
npm run dev          # 运行 CLI
npm run mcp          # 启动 MCP Server
npm test             # 运行测试
npm run check        # TypeScript 类型检查
npm run build        # 构建生产产物
```

## MVP 已实现

- ✅ 飞书鉴权（token 获取/缓存/刷新）
- ✅ 单文档导出（export-doc）
- ✅ Wiki 递归导出（export-wiki，支持断点续导）
- ✅ DocAST 生成（10+ 块类型，Zod schema 校验）
- ✅ Markdown 渲染（保留嵌套列表层级）
- ✅ 图片下载 + 格式检测（png/jpg/webp/gif/svg）
- ✅ 表格 CSV 导出 + sources.json 来源追溯
- ✅ 图片 AI 摘要（OpenAI/Mock provider，并发控制）
- ✅ MCP Server 集成（3 个 tools）

## License

MIT
