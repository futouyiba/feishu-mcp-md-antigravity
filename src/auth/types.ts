export interface AuthConnection {
    /**
     * 关联的用户ID，CLI/单机场景下通常为 "local"
     */
    userId: string;
    /**
     * Provider 的唯一标识，比如 "openai", "google"
     */
    provider: string;
    /**
     * 第三方 Provider 返回的内容账号 ID，可为空
     */
    accountId?: string;
    /**
     * 本次授权覆盖的 Scopes
     */
    scopes: string[];
    /**
     * OAuth Access Token，用于 API 请求鉴权
     */
    accessToken: string;
    /**
     * OAuth Refresh Token，用于刷新 Access Token
     */
    refreshToken?: string;
    /**
     * Access Token 的过期时间戳 (毫秒)
     */
    expiresAt: number;
    /**
     * 附加元信息
     */
    metadata?: Record<string, unknown>;
}

export interface AuthStore {
    getConnection(userId: string, provider: string): Promise<AuthConnection | null>;
    saveConnection(connection: AuthConnection): Promise<void>;
    deleteConnection(userId: string, provider: string): Promise<void>;
    listConnections(userId: string): Promise<AuthConnection[]>;
}

export interface AuthProvider {
    /**
     * Provider 名称，全局唯一
     */
    name: string;

    /**
     * 返回开启 PKCE Login 流所需跳转的 Authorization URL
     */
    startLogin(state: string, codeChallenge: string, redirectUri: string): string;

    /**
     * 利用回传的 Code 与本地的 Code Verifier 向 Provider 请求完整的 Token
     */
    handleCallback(code: string, codeVerifier: string, redirectUri: string): Promise<Omit<AuthConnection, "userId" | "provider">>;

    /**
     * 刷新过期或即将过期的 Token
     */
    refresh(connection: AuthConnection): Promise<AuthConnection>;

    /**
     * 在向下游（如 OpenAI / Google 官方接口）发起真正请求时，注入由于该 Provider 对端需要的特定鉴权 Header
     * (如 Authorization: Bearer xxxx, 或是特有的其它头部)
     */
    injectAuth(request: Record<string, any>, connection: AuthConnection): void;
}
