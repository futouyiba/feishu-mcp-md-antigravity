import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppConfig } from "../core/config.js";

type TokenCache = {
  tenant_access_token: string;
  expires_at_ms: number;
};

type TokenResponse = {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
};

const CACHE_FILE = path.join(".cache", "feishu-token.json");
const REFRESH_SKEW_MS = 60_000;

async function readCache(): Promise<TokenCache | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as TokenCache;
    if (!parsed.tenant_access_token || !parsed.expires_at_ms) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(cache: TokenCache): Promise<void> {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

export async function getTenantAccessToken(config: AppConfig): Promise<string> {
  const cached = await readCache();
  const now = Date.now();
  if (cached && cached.expires_at_ms - REFRESH_SKEW_MS > now) {
    return cached.tenant_access_token;
  }

  const response = await fetch(
    `${config.FEISHU_BASE_URL}/open-apis/auth/v3/app_access_token/internal`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        app_id: config.FEISHU_APP_ID,
        app_secret: config.FEISHU_APP_SECRET,
      }),
    },
  );

  const payload = (await response.json()) as TokenResponse;
  if (!response.ok || payload.code !== 0 || !payload.tenant_access_token) {
    throw new Error(
      `failed to get token: ${payload.msg} (code=${payload.code}, http=${response.status})`,
    );
  }

  const expireSeconds = payload.expire ?? 7200;
  const cache: TokenCache = {
    tenant_access_token: payload.tenant_access_token,
    expires_at_ms: now + expireSeconds * 1000,
  };
  await writeCache(cache);
  return cache.tenant_access_token;
}
