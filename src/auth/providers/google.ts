import { AuthConnection, AuthProvider } from "../types.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || "mock_google_client_id.apps.googleusercontent.com";
const GOOGLE_AUTH_ENDPOINT = process.env.GOOGLE_OAUTH_AUTH_ENDPOINT || "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = process.env.GOOGLE_OAUTH_TOKEN_ENDPOINT || "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = (process.env.GOOGLE_OAUTH_SCOPES || "openid profile email").split(" ");

export class GoogleAuthProvider implements AuthProvider {
    name = "google";

    startLogin(state: string, codeChallenge: string, redirectUri: string): string {
        const params = new URLSearchParams({
            response_type: "code",
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri,
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            scope: GOOGLE_SCOPES.join(" "),
            access_type: "offline", // Needed for Google to return a refresh token
            prompt: "consent",      // Required alongside access_type=offline on first login
        });
        return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
    }

    async handleCallback(code: string, codeVerifier: string, redirectUri: string): Promise<Omit<AuthConnection, "userId" | "provider">> {
        const params = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: GOOGLE_CLIENT_ID,
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        });

        const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            body: params.toString(),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Google OAuth callback failed: ${res.status} ${errorText}`);
        }

        const data = await res.json() as any;

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in || 3599) * 1000,
            scopes: (data.scope || "").split(" "),
            metadata: data,
        };
    }

    async refresh(connection: AuthConnection): Promise<AuthConnection> {
        if (!connection.refreshToken) {
            throw new Error("No refresh token available. User must re-authenticate.");
        }

        const params = new URLSearchParams({
            grant_type: "refresh_token",
            client_id: GOOGLE_CLIENT_ID,
            refresh_token: connection.refreshToken,
        });

        const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            body: params.toString(),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Google OAuth refresh failed: ${res.status} ${errorText}`);
        }

        const data = await res.json() as any;

        return {
            ...connection,
            accessToken: data.access_token,
            refreshToken: data.refresh_token || connection.refreshToken, // Google typically does not issue new refresh token here
            expiresAt: Date.now() + (data.expires_in || 3599) * 1000,
            scopes: data.scope ? data.scope.split(" ") : connection.scopes,
            metadata: { ...connection.metadata, ...data },
        };
    }

    injectAuth(request: Record<string, any>, connection: AuthConnection): void {
        if (!request.headers) {
            request.headers = {};
        }
        request.headers["Authorization"] = `Bearer ${connection.accessToken}`;
        // E.g., handle projectId injection if requested by specific API headers
        if (connection.metadata?.projectId) {
            request.headers["x-goog-project-id"] = connection.metadata.projectId;
        }
    }
}
