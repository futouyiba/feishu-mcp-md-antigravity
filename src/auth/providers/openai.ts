import { AuthConnection, AuthProvider } from "../types.js";

// Uses process.env fallback approach, in a real scenario you would parse this from a config file.
const OPENAI_CLIENT_ID = process.env.OPENAI_OAUTH_CLIENT_ID || "mock_openai_client_id";
const OPENAI_AUTH_ENDPOINT = process.env.OPENAI_OAUTH_AUTH_ENDPOINT || "https://auth.openai.com/authorize";
const OPENAI_TOKEN_ENDPOINT = process.env.OPENAI_OAUTH_TOKEN_ENDPOINT || "https://auth.openai.com/oauth/token";
const OPENAI_SCOPES = (process.env.OPENAI_OAUTH_SCOPES || "openid profile email api").split(" ");

export class OpenAIAuthProvider implements AuthProvider {
    name = "openai";

    startLogin(state: string, codeChallenge: string, redirectUri: string): string {
        const params = new URLSearchParams({
            response_type: "code",
            client_id: OPENAI_CLIENT_ID,
            redirect_uri: redirectUri,
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            scope: OPENAI_SCOPES.join(" "),
        });
        return `${OPENAI_AUTH_ENDPOINT}?${params.toString()}`;
    }

    async handleCallback(code: string, codeVerifier: string, redirectUri: string): Promise<Omit<AuthConnection, "userId" | "provider">> {
        const params = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: OPENAI_CLIENT_ID,
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        });

        const res = await fetch(OPENAI_TOKEN_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            body: params.toString(),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`OpenAI OAuth callback failed: ${res.status} ${errorText}`);
        }

        const data = await res.json() as any;

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
            scopes: (data.scope || "").split(" "),
            accountId: data.userId || data.account_id,
            metadata: data,
        };
    }

    async refresh(connection: AuthConnection): Promise<AuthConnection> {
        if (!connection.refreshToken) {
            throw new Error("No refresh token available. User must re-authenticate.");
        }

        const params = new URLSearchParams({
            grant_type: "refresh_token",
            client_id: OPENAI_CLIENT_ID,
            refresh_token: connection.refreshToken,
        });

        const res = await fetch(OPENAI_TOKEN_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            body: params.toString(),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`OpenAI OAuth refresh failed: ${res.status} ${errorText}`);
        }

        const data = await res.json() as any;

        return {
            ...connection,
            accessToken: data.access_token,
            refreshToken: data.refresh_token || connection.refreshToken,
            expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
            scopes: data.scope ? data.scope.split(" ") : connection.scopes,
            metadata: { ...connection.metadata, ...data },
        };
    }

    injectAuth(request: Record<string, any>, connection: AuthConnection): void {
        if (!request.headers) {
            request.headers = {};
        }
        // Bearer token injection
        request.headers["Authorization"] = `Bearer ${connection.accessToken}`;
        if (connection.accountId) {
            request.headers["OpenAI-Organization"] = connection.accountId;
        }
    }
}
