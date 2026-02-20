import { exportDoc } from "./export-doc.js";
import { AppConfig, loadConfig } from "./config.js";
import { parseWikiToken } from "./parse-wiki-token.js";
import { getTenantAccessToken } from "../feishu/auth.js";
import { getWikiNode, listWikiChildNodes, WikiNode } from "../feishu/api.js";
import { access } from "node:fs/promises";
import path from "node:path";

function isDocNode(node: WikiNode): boolean {
  return node.obj_type.toLowerCase() === "docx" && Boolean(node.obj_token);
}

async function walkAndExport(params: {
  config: AppConfig;
  token: string;
  outDir: string;
  spaceId: string;
  parentNodeToken: string;
  recursive: boolean;
  exported: Set<string>;
  skipExisting: boolean;
}): Promise<void> {
  const children = await listWikiChildNodes(
    params.config,
    params.token,
    params.spaceId,
    params.parentNodeToken,
  );

  for (const node of children) {
    if (isDocNode(node) && !params.exported.has(node.obj_token)) {
      params.exported.add(node.obj_token);
      const marker = path.join(params.outDir, "docs", node.obj_token, "docast.json");
      let exists = false;
      if (params.skipExisting) {
        try {
          await access(marker);
          exists = true;
        } catch {
          exists = false;
        }
      }
      if (!exists) {
        await exportDoc({
          docInput: node.obj_token,
          outDir: params.outDir,
          config: params.config,
          accessToken: params.token,
        });
      } else {
        // eslint-disable-next-line no-console
        console.log(`Skip existing doc ${node.obj_token}`);
      }
    }

    if (params.recursive && node.has_child) {
      await walkAndExport({
        ...params,
        parentNodeToken: node.node_token,
      });
    }
  }
}

export async function exportWiki(params: {
  wikiInput: string;
  outDir: string;
  recursive: boolean;
  force?: boolean;
}): Promise<void> {
  const config = loadConfig();
  const token = await getTenantAccessToken(config);
  const wikiToken = parseWikiToken(params.wikiInput);
  const rootNode = await getWikiNode(config, token, wikiToken);
  const exported = new Set<string>();
  const skipExisting = !params.force;

  if (isDocNode(rootNode)) {
    exported.add(rootNode.obj_token);
    const marker = path.join(params.outDir, "docs", rootNode.obj_token, "docast.json");
    let exists = false;
    if (skipExisting) {
      try {
        await access(marker);
        exists = true;
      } catch {
        exists = false;
      }
    }
    if (!exists) {
      await exportDoc({
        docInput: rootNode.obj_token,
        outDir: params.outDir,
        config,
        accessToken: token,
      });
    } else {
      // eslint-disable-next-line no-console
      console.log(`Skip existing doc ${rootNode.obj_token}`);
    }
  }

  await walkAndExport({
    config,
    token,
    outDir: params.outDir,
    spaceId: rootNode.space_id,
    parentNodeToken: rootNode.node_token,
    recursive: params.recursive,
    exported,
    skipExisting,
  });

  // eslint-disable-next-line no-console
  console.log(`Exported wiki ${wikiToken}: ${exported.size} docs`);
}
