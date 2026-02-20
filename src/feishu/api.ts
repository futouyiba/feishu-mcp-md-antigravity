import { AppConfig } from "../core/config.js";

type FeishuResponse<T> = {
  code: number;
  msg: string;
  data?: T;
};

type TextElement = {
  text_run?: {
    content?: string;
  };
  text_element_style?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    inline_code?: boolean;
  };
  equation?: {
    content?: string;
  };
  reminder?: {
    mention?: {
      title?: string;
    };
  };
  docs_link?: {
    url?: string;
  };
  person?: {
    name?: string;
  };
};

type DocumentData = {
  document: {
    document_id: string;
    title: string;
  };
};

type WikiNode = {
  space_id: string;
  node_token: string;
  obj_token: string;
  obj_type: string;
  parent_node_token?: string;
  title?: string;
  has_child?: boolean;
};

type Block = {
  block_id: string;
  parent_id: string;
  children?: string[];
  block_type: number;
  text?: {
    elements?: TextElement[];
  };
  heading1?: Block["text"];
  heading2?: Block["text"];
  heading3?: Block["text"];
  heading4?: Block["text"];
  heading5?: Block["text"];
  heading6?: Block["text"];
  bullet?: Block["text"];
  ordered?: Block["text"];
  quote?: Block["text"];
  code?: {
    language?: number;
    elements?: TextElement[];
  };
  callout?: {
    elements?: TextElement[];
  };
  todo?: {
    style?: {
      done?: boolean;
    };
    elements?: TextElement[];
  };
  image?: {
    token?: string;
    file_token?: string;
    alt?: string;
  };
  table?: {
    cells?: string[][];
  };
  table_cell?: {
    elements?: TextElement[];
  };
  sheet?: {
    token?: string;
  };
  divider?: Record<string, never>;
};

type BlocksData = {
  items: Block[];
  page_token?: string;
  has_more: boolean;
};

type WikiNodeResponseData = {
  node: WikiNode;
};

type WikiNodesListData = {
  items: WikiNode[];
  has_more: boolean;
  page_token?: string;
};

async function request<T>(
  config: AppConfig,
  token: string,
  path: string,
): Promise<FeishuResponse<T>> {
  const response = await fetch(`${config.FEISHU_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
  const payload = (await response.json()) as FeishuResponse<T>;
  if (!response.ok) {
    throw new Error(`request failed: http=${response.status} msg=${payload.msg}`);
  }
  return payload;
}

export async function getDocument(
  config: AppConfig,
  token: string,
  documentId: string,
): Promise<DocumentData["document"]> {
  const payload = await request<DocumentData>(
    config,
    token,
    `/open-apis/docx/v1/documents/${documentId}`,
  );
  if (payload.code !== 0 || !payload.data) {
    throw new Error(`get document failed: code=${payload.code} msg=${payload.msg}`);
  }
  return payload.data.document;
}

export async function listAllBlocks(
  config: AppConfig,
  token: string,
  documentId: string,
): Promise<Block[]> {
  const all: Block[] = [];
  let pageToken = "";

  do {
    const query = new URLSearchParams({
      page_size: "500",
    });
    if (pageToken) {
      query.set("page_token", pageToken);
    }

    const payload = await request<BlocksData>(
      config,
      token,
      `/open-apis/docx/v1/documents/${documentId}/blocks?${query.toString()}`,
    );
    if (payload.code !== 0 || !payload.data) {
      throw new Error(`list blocks failed: code=${payload.code} msg=${payload.msg}`);
    }
    all.push(...payload.data.items);
    pageToken = payload.data.has_more ? payload.data.page_token ?? "" : "";
  } while (pageToken);

  return all;
}

export async function getWikiNode(
  config: AppConfig,
  token: string,
  wikiToken: string,
): Promise<WikiNode> {
  const query = new URLSearchParams({ token: wikiToken });
  const payload = await request<WikiNodeResponseData>(
    config,
    token,
    `/open-apis/wiki/v2/spaces/get_node?${query.toString()}`,
  );
  if (payload.code !== 0 || !payload.data?.node) {
    throw new Error(`get wiki node failed: code=${payload.code} msg=${payload.msg}`);
  }
  return payload.data.node;
}

export async function listWikiChildNodes(
  config: AppConfig,
  token: string,
  spaceId: string,
  parentNodeToken?: string,
): Promise<WikiNode[]> {
  const items: WikiNode[] = [];
  let pageToken = "";

  do {
    const query = new URLSearchParams({ page_size: "50" });
    if (parentNodeToken) {
      query.set("parent_node_token", parentNodeToken);
    }
    if (pageToken) {
      query.set("page_token", pageToken);
    }

    const payload = await request<WikiNodesListData>(
      config,
      token,
      `/open-apis/wiki/v2/spaces/${spaceId}/nodes?${query.toString()}`,
    );
    if (payload.code !== 0 || !payload.data) {
      throw new Error(`list wiki nodes failed: code=${payload.code} msg=${payload.msg}`);
    }
    items.push(...payload.data.items);
    pageToken = payload.data.has_more ? payload.data.page_token ?? "" : "";
  } while (pageToken);

  return items;
}

export async function downloadMedia(
  config: AppConfig,
  token: string,
  fileToken: string,
): Promise<{ data: ArrayBuffer; contentType?: string }> {
  const response = await fetch(
    `${config.FEISHU_BASE_URL}/open-apis/drive/v1/medias/${fileToken}/download`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`download media failed: token=${fileToken} http=${response.status}`);
  }
  return {
    data: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? undefined,
  };
}

export type { Block, WikiNode };
