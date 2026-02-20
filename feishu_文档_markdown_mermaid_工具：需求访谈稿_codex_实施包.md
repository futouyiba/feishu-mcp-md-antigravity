# 目标（你要交给 Codex 的“可执行需求”）

你要做的不是“写个 App”，而是一套**可复用的转换流水线/工具链**：把飞书（Feishu/Lark）文档内容通过 MCP Server 拉取与解析，输出为：

- **Markdown（正文 + 结构）**
- **图片（可下载链接/本地文件）**
- **Mermaid（流程/结构图尽量结构化表达）**
- 以及必要的 **SVG/JSON 等“模型友好中间格式”**（用于未来二次转换与研发指导）

同时，你希望对“图片/画板/图表”做**多模态摘要 digest**，让后续大模型阅读 Markdown 时，先读 digest 决定要不要再点开图片。

> ⚠️ 安全提醒：你在聊天里贴了 App Secret。建议**立刻在飞书开放平台里旋转/重置 Secret**，并把已泄露的当作作废。这里的方案不会再复述你的 Secret。

---

# 你现在的前提事实（来自飞书开放平台文档）

- 自建应用可通过 `app_id + app_secret` 获取 `tenant_access_token`，**有效期通常为 2 小时**，用于调用 OpenAPI。
- 飞书/Lark 已提供 **OpenAPI MCP** 相关能力与“远程 MCP Server”接入说明（Beta/持续演进）。
- 官方也有把 Feishu/Lark OpenAPI 封装成 MCP 工具的实现/仓库与 npm 包（便于直接接入 Agent 或自动化工作流）。

（这些点在官方文档与官方 MCP 工具项目里都有描述。）

---

# 你已给出的关键决策（已收敛）

## 输入范围

- 只处理：**飞书文档（Docs）+ 知识库（Wiki）**
- 不处理：多维表格（Bitable）、飞书表格（Spreadsheet）、独立 Spreadsheet 文件

## 输出范围

- 只需要：**Markdown + 附件（图片/表格导出等）+ 中间结构数据（DocAST）**
- 不需要：静态站点/HTML（所以我之前提到的 index 不是指 HTML 首页；见下文“index.md 的含义”）

## 运行形态

- 先做 **CLI**（最稳妥）
- 后续再增强自动化/集成（例如：批量导出、增量更新、接入 MCP 编排等）

## 一致性与可逆性（你的取舍）

- 最关键：**语义意义还原**（结构、层级、意群清晰、可读可沟通）
- 可逆同步：**不追求严格可逆**（成本极高），未来若要回写，走“LLM 理解 + 差分操作”的半自动路线

## 最小正确性指标（MVP 验收底线）

1. Markdown 预览下人能读懂：标题/段落/意群的层级表达清晰
2. 不偏题：语义保持、段落中心意思不丢
3. 元素不丢：飞书中的图片/表格等，在导出物里都有承接（digest + 附件/引用）
4. 表格：能落为 Markdown table；嵌入式“电子表格”优先转 md table，同时保留 CSV（并记录来源信息）
5. 图：允许保底 SVG，不强制 Mermaid（是否 Mermaid 取决于性价比）

---

# index.md 的含义（澄清）

这里的 `index.md` **不是 HTML 首页**，只是“该文档的主 Markdown 文件”。如果你更喜欢叫 `doc.md` 或 `<title>.md`，在实现里可以改名；结构上我建议保持固定文件名，利于自动化。

---

# 需求访谈（Interview）+ 挑战（Challenge）清单（保留为工程可配置项）

下面这些问题不用你再回答，作为 Codex 实施时的可配置/可扩展点写进 README 和配置文件。

## A. Wiki 与 Docs 的关系

- Wiki 是“目录/索引”，Docs 是“叶子文档”。工具需要：
  - 支持输入一个 wiki 节点：递归导出其下所有 docs
  - 支持输入一个 doc：只导出单篇

## B. 语义还原 vs 视觉还原

- 以语义还原为主：
  - 标题层级、列表层级、引用/代码块/分割线等语义块优先
  - 字体、颜色、复杂排版可降级（但不能导致误读）

## C. 回写（未来）不做严格可逆，但要“可定位”

- DocAST 必须保留：`block_id`、资源 `asset_id`、来源 URL / doc\_id
- 这样未来让 LLM 回写时，能定位到“改动发生在原文哪里”。

---

# 总体方案（建议按“先跑通，再变强”）

## Phase 0：跑通链路（1-2 天级别）

- 能拿到 token
- 能列出/拉取指定 doc
- 能把正文 block 转成 md（标题/段落/粗斜体/引用/代码块/链接/普通表格/列表）
- 能把图片附件下载到本地 `assets/`，并在 md 中引用

## Phase 1：结构化中间层（关键）

先不要直接“边读边写 md”。建议先落一个 **DocAST（JSON）**：

- 保留 block 层级、列表层级、内联样式、附件引用、原始 block id
- md 只是 DocAST 的一个 renderer

这样你后续要：

- 修复“多级列表抹平”
- 支持更多块类型
- 生成 Mermaid
- 做增量更新（diff） 都会容易很多。

## Phase 2：图片 digest（多模态）

- 先把图片当资源下载
- 生成一个 **ImageDigest**（短文本 + 结构字段）写回 md 中
- 后续 agent 读 md 时先读 digest，再决定是否加载图片

## Phase 3：画板/流程图

- 保底输出 SVG/PNG + digest
- 可选：尝试自动 Mermaid（成功率不保证，但可给人工二次编辑）

---

# 关键：中间格式与数据格式建议

## 1) DocAST（建议 JSON Schema）

目标：

- 100% 保留层级与引用
- 让模型友好（字段明确、可局部读取、可增量 diff）

最小字段建议：

```json
{
  "doc": {
    "doc_id": "...",
    "title": "...",
    "source": {"type": "feishu_doc", "url": "..."},
    "blocks": [
      {"id": "b1", "type": "heading", "level": 2, "text_runs": [...]},
      {"id": "b2", "type": "paragraph", "text_runs": [...]},
      {"id": "b3", "type": "list", "ordered": true, "items": [...], "nesting": "tree"},
      {"id": "b4", "type": "image", "asset_id": "a1", "caption_runs": [...]},
      {"id": "b5", "type": "table", "rows": [[...],[...]]}
    ],
    "assets": {
      "a1": {"kind": "image", "filename": "assets/a1.png", "mime": "image/png", "source": "..."}
    }
  }
}
```

> 多级列表抹平的核心原因通常是：你直接输出 md 时缺少“显式层级信息”。DocAST 里必须把层级编码成树（items 递归）或显式 `indent_level`。

## 2) Markdown 输出约定（含 digest）

建议每个 doc 输出：

- `docs/<doc_id>/index.md`
- `docs/<doc_id>/assets/*`
- `docs/<doc_id>/docast.json`

图片在 md 中的占位建议用一种“机器可解析”的块（YAML fence）：

````md
![<alt text 简短>](assets/a1.png)

```image-digest
id: a1
role: diagram | screenshot | chart | photo | whiteboard
summary: "一句话说明这张图在本文中想表达什么"
key_points:
  - "关键信息 1"
  - "关键信息 2"
entities:
  - type: component
    name: "DerivedEnvField"
  - type: metric
    name: "hit_rate"
relationships:
  - "A -> B 表示..."
need_open_image_when:
  - "要确认具体参数/小字"
confidence: 0.74
````

```

这样：
- 单模型读 md 时，先读 digest；
- 只有当 `need_open_image_when` 触发时，才去加载图片。

## 3) 画板/流程图的“模型友好保真格式”
优先级建议：
1. **SVG（首选）**：结构可读、可放大、模型也更容易从矢量结构/文字里提取信息
2. **JSON（如果飞书画板能导出内部结构）**：最适合二次渲染与生成 Mermaid
3. PNG：最后保底

如果你要兼容未来“同步回飞书”，那就要在 DocAST 里保留：
- 原始 block id
- 图资源与其在文档中的锚点位置

---

# Codex 执行包（直接复制给 Codex）

下面是你可以直接扔给 Codex 的提示词（它会产出代码/项目结构）。

## 0) 统一约束
- 先做 CLI
- 先支持单篇 doc（通过 URL 或 doc_id）
- 输出目录结构固定
- 先用 DocAST 再渲染 Markdown

## 1) Codex Prompt：项目骨架 + 核心流程

**Prompt：**

你是资深 TypeScript/Node.js 工程师。请实现一个 CLI 工具 `feishu-doc-exporter`，目标是把飞书文档通过 OpenAPI/MCP 拉取并导出为 `DocAST(JSON) + Markdown + assets`。

### 功能
1. `export --doc <doc_url_or_id> --out <dir>`
2. 自动获取 `tenant_access_token`（从环境变量读取 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`）
3. 通过飞书开放平台 API / 或官方 OpenAPI MCP（若更易集成）拉取文档内容与附件
4. 生成：
   - `docast.json`
   - `index.md`
   - `assets/*`（图片等）

### Markdown 规则
- 标题映射 `#..######`
- 列表必须保留层级（支持多级有序/无序混合）
- 表格：普通 table 转 md table
- 图片：下载到 assets，并在 md 中插入 image-digest 块（先写占位 digest，后续再接多模态模型）

### DocAST 规则
- block 必须带 `id`, `type`
- list 必须递归表示层级，避免抹平
- image block 必须引用 `assets` 表

### 工程要求
- TypeScript + ESM
- `zod` 定义 DocAST schema
- `commander` 或 `yargs` 做 CLI
- 允许未来扩展：`--with-image-digest`（接入多模态模型）
- 处理 token 过期与重试

### 输出结构
```

/docs/\<doc\_id>/ index.md docast.json assets/ a1.png ...

```

### 交付
- 完整可运行代码
- README：安装、环境变量、示例命令
- 单元测试：至少覆盖 list 层级渲染

---

## 2) Codex Prompt：ImageDigest 生成器（可选第二步）

实现 `digest-images --docast <path> --md <path> --assets <dir>`：
- 遍历 md 中的图片
- 调用一个抽象接口 `ImageCaptioner`（先写 mock 实现）
- 把结果填充到 `image-digest` fence 中

要求：
- `ImageCaptioner` 的输入必须包含：图片路径 + 该图片附近 200-400 字的上下文文本（从 DocAST 或 md 提取）

---

# MVP 范围与验收标准（你要求我补的“硬标准”）

下面是可以直接写进项目 README / CI 的验收标准，Codex 按这个交付。

## 1) MVP 必须支持的块类型（Docs & Wiki 页面）

### 文本与结构
- Heading（H1-H6）
- Paragraph（含粗体/斜体/删除线/行内代码/链接）
- Quote / Callout（至少一种引用语义块）
- Code block（语言标注若拿不到则降级为普通 code fence）
- Divider（分割线）

### 列表（高优先）
- 无序列表（多级）
- 有序列表（多级）
- 有序/无序混合嵌套（至少保证不抹平）

### 资源
- Image：
  - 下载到 `assets/`
  - md 引用 + `image-digest` fence（先占位，Phase 2 再真生成）
- 普通表格（table）：转 md table
- 嵌入式“电子表格”：
  - 优先：转 md table（当规模可控）
  - 同时：导出 CSV
  - 必须：记录来源信息（见下）

### 允许降级（MVP 可不做或保底）
- 画板/流程图：保底 SVG/PNG + digest（不强制 Mermaid）
- 复杂富文本样式：颜色、字号、对齐、注释等可降级

---

## 2) 电子表格 / 嵌入式表格：你想要的 A+B 落地规则

输出建议（同时满足“可读”与“可追溯”）：

- `index.md` 中：
  - 若表格不大：直接渲染为 md table
  - 表格太大：只放前 N 行 + 提示“完整见 CSV”（N 例如 30，可配置）

- `assets/tables/<table_id>.csv`：
  - 始终生成

- `sources.json`（或 `sources.md`）：
  - 记录该 CSV 的来源：
    - 原文 doc_id + block_id
    - 若存在外链/引用 id 也记录
    - 导出时间、行列数、是否截断

这样做的好处：
- Markdown 可读（沟通用）
- 数据可复用（后续进 AI 知识库或再加工）
- 追溯清楚（知道 CSV 从哪来的）

---

## 3) “最小正确性指标”转成可测试/可验收条目

### 人工验收（每次发版抽检 5-10 篇）
1. 标题层级正确（H1/H2/H3 不乱跳；至少不把正文误变成标题）
2. 列表层级正确（不会抹平；嵌套关系与原文一致或语义等价）
3. 图片不丢：每张图都有 md 引用 + 本地 asset + digest 占位
4. 表格不丢：每个表格都在 md 中出现（table 或“见 CSV”占位）+ CSV 文件存在
5. 链接不丢：原文链接在 md 中可见

### 自动验收（CI）
- 结构完整性：
  - `docast.json` 必须通过 zod schema 校验
  - `assets` 里引用的文件都存在
  - md 中引用的 `asset_id` 都能在 DocAST 的 assets 表找到

- 列表层级单测（关键）：
  - 给定 DocAST 样例（包含：多级有序/无序/混合）
  - 渲染 md 后，验证：
    - 缩进层级正确（例如 2 空格或 4 空格统一）
    - 有序列表编号策略稳定（允许全部 1. 也可以，但层级不能丢）

- 表格单测：
  - 普通 table -> md table（行列数一致）
  - 电子表格 -> md table 或截断策略（触发规则可测）+ CSV 必须生成

---

## 4) 画板：SVG vs JSON 的优先级（你的“性价比”问题我给结论）

### 结论：MVP 先 **SVG 优先**，JSON 作为“可能的增强项”
- SVG 优点：
  - 保真、可放大
  - 对模型更友好（文字/结构比 PNG 更可读）
  - 工程上可控：能导出就落地

- JSON（若飞书画板能拿到结构）：
  - 是“终极最优解”，因为可二次渲染/可生成 Mermaid/可做 diff
  - 但前提是：飞书确实提供稳定的结构化导出接口或你能可靠解析其内部格式

### Mermaid 的定位
- Mermaid 不作为“唯一真相”
- 作为“二次产物”可选生成：
  - 生成失败就回退 SVG

---

# 为什么“严格可逆同步”代价极高（给你一段评估口径）

严格可逆意味着：
- 你必须保留飞书的所有排版与富文本语义
- 你必须在 md 的改动上做精确对齐到原文 block / inline run
- 一旦用户在 md 做了自由编辑（重排段落、拆并列表、移动图片），就很难自动映射回飞书结构

因此更合理路线是：
- DocAST 保留定位信息（block_id 等）
- 回写时让 LLM 做“语义理解 + 变更计划（plan）”，再调用飞书写入 API
- 并且把回写做成 **半自动**（需要人 review）

---

# Codex 实施包（根据你最新答案更新版）

把下面两段直接复制给 Codex。

## Prompt A：Docs + Wiki 导出（MVP）

你是资深 TypeScript/Node.js 工程师。实现 CLI 工具 `feishu-md-export`，输入为飞书 Docs 或 Wiki 节点，输出为 `DocAST(JSON) + Markdown + assets`。

### 输入范围
- 只支持：Docs 与 Wiki
- 不支持：Bitable、多维表格、Spreadsheet（独立飞书表格）

### 命令
1) `export-doc --doc <doc_url_or_id> --out <dir>`
2) `export-wiki --wiki <wiki_url_or_id> --out <dir> --recursive`

### 鉴权
- 从环境变量读取：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`
- 获取 `tenant_access_token` 并缓存到本地（含过期刷新）

### 输出结构
```

/docs/\<doc\_id>/ index.md docast.json sources.json assets/ images/ tables/

```

### DocAST
- 用 `zod` 定义 schema
- blocks 必须包含 `id`, `type`
- 保留 `source` 信息：doc_id、block_id、原文 url
- 列表必须是树形结构（递归 items），不能抹平

### Markdown 渲染规则（MVP）
- Heading/Paragraph/Quote/Code block/Divider
- 列表：多级有序/无序/混合必须保层级
- 图片：下载到 assets/images，并在 md 中插入：图片引用 + `image-digest` fence（先写占位）
- 普通表格：转 md table
- 嵌入式“电子表格”：
  - 生成 md table（若过大允许截断）
  - 同时导出 CSV 到 assets/tables
  - 在 sources.json 记录来源（doc_id + block_id + 行列数 + 是否截断）

### 质量要求
- README：安装、环境变量、示例命令
- 单测：至少覆盖列表层级渲染、表格导出与 sources.json 生成

## Prompt B：ImageDigest 生成器（第二阶段，可先留接口）

实现命令 `digest-images --docast <path> --md <path> --assets <dir>`：
- 读取 md 中的图片块
- 从 DocAST 提取该图片附近 200-400 字上下文
- 调用抽象接口 `ImageCaptioner`（先做 mock），把结果写入 `image-digest` fence

---

# 你可能忽略但会踩坑的点（更新版挑战清单）

1) Wiki 的“目录结构”要不要映射到输出目录？建议：
- 输出目录里保留 wiki path（利于检索与知识库组织）

2) 列表层级：不要从渲染端猜缩进，必须由 DocAST 数据决定

3) 表格太大：md 里可截断，但 CSV 必须完整（若 API 支持）；否则 sources.json 标注“受限于接口仅导出部分”

---

# 参考（你贴的官方入口 + 相关官方资料）

- 飞书开放平台：调用远程 MCP Server（开发者模式）
- 飞书开放平台：获取 access token / tenant_access_token 的流程
- 官方 OpenAPI MCP 工具项目（封装 OpenAPI 为 MCP tools）


- 飞书开放平台：调用远程 MCP Server（开发者模式）
- 飞书开放平台：获取 access token / tenant_access_token 的流程
- 官方 OpenAPI MCP 工具项目（封装 OpenAPI 为 MCP tools）

（你后续如果希望我把这些资料整理成“可直接放进 README 的引用段落”，我也可以继续补。）

```
