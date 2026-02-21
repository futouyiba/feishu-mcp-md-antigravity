import { AuthConnection, AuthProvider, AuthStore } from "./types.js";
import { FileAuthStore } from "./store.js";
import { LocalOAuthServer } from "./server.js";
import { generateCodeChallenge, generateCodeVerifier, generateState } from "./pkce.js";
import { OpenAIAuthProvider } from "./providers/openai.js";
import { GoogleAuthProvider } from "./providers/google.js";

// Ensure platform "open" command equivalent is available
import { exec } from "node:child_process";
import os from "node:os";

function openBrowser(url: string) {
    let command = "";
    if (os.platform() === "win32") {
        command = `start "" "${url}"`;
    } else if (os.platform() === "darwin") {
        command = `open "${url}"`;
    } else {
        command = `xdg-open "${url}"`;
    }
    exec(command);
}

export class AuthService {
    private store: AuthStore;
    private providers: Map<string, AuthProvider> = new Map();

    constructor(store?: AuthStore) {
        this.store = store || new FileAuthStore();
        this.registerProvider(new OpenAIAuthProvider());
        this.registerProvider(new GoogleAuthProvider());
    }

    registerProvider(provider: AuthProvider) {
        this.providers.set(provider.name, provider);
    }

    getProvider(name: string): AuthProvider {
        const p = this.providers.get(name);
        if (!p) {
            throw new Error(`Auth Provider '${name}' not found.`);
        }
        return p;
    }

    async connect(providerName: string, userId: string = "local", port = 8080): Promise<AuthConnection> {
        const provider = this.getProvider(providerName);
        const localServer = new LocalOAuthServer(port);

        const state = generateState();
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier);

        const loginUrl = provider.startLogin(state, challenge, localServer.redirectUri);

        console.log(`Starting OAuth logic for ${providerName}...`);
        console.log(`Please login in your browser. If it doesn't open automatically, click here: \n${loginUrl}`);

        openBrowser(loginUrl);

        // Wait for the browser to redirect back to our local server
        const { code, state: returnedState } = await localServer.waitForCallback(state);

        console.log("Authorization code received. Exchanging for tokens...");

        const partialConn = await provider.handleCallback(code, verifier, localServer.redirectUri);

        const connection: AuthConnection = {
            userId,
            provider: providerName,
            ...partialConn
        };

        await this.store.saveConnection(connection);
        console.log(`Successfully connected ${providerName}!`);
        return connection;
    }

    async disconnect(providerName: string, userId: string = "local") {
        await this.store.deleteConnection(userId, providerName);
        console.log(`Disconnected ${providerName}.`);
    }

    async listConnections(userId: string = "local"): Promise<AuthConnection[]> {
        return this.store.listConnections(userId);
    }

    /**
     * Automatically fetches connection, refreshes it if needed, and applies auth headers to an options object payload.
     */
    async injectAuth(providerName: string, requestOptions: Record<string, any>, userId: string = "local") {
        let connection = await this.store.getConnection(userId, providerName);
        if (!connection) {
            throw new Error(`Authentication required for ${providerName}. Please run 'feishu-md-export auth login ${providerName}'`);
        }

        // Refresh if expiring within 2 minutes
        if (connection.expiresAt < Date.now() + 2 * 60 * 1000) {
            console.log(`Token for ${providerName} is expired or nearing expiration. Refreshing...`);
            const provider = this.getProvider(providerName);
            connection = await provider.refresh(connection);
            await this.store.saveConnection(connection);
        }

        const provider = this.getProvider(providerName);
        provider.injectAuth(requestOptions, connection);
    }

    async getConnection(userId: string, providerName: string): Promise<AuthConnection | null> {
        const connection = await this.store.getConnection(userId, providerName);
        if (!connection) {
            return null;
        }

        if (connection.expiresAt < Date.now() + 2 * 60 * 1000) {
            try {
                const provider = this.getProvider(providerName);
                const refreshed = await provider.refresh(connection);
                await this.store.saveConnection(refreshed);
                return refreshed;
            } catch (err: any) {
                console.warn(`Failed to refresh token for ${providerName}: ${err.message}`);
                // Cannot refresh automatically, return the expired token and let the downstream API throw 401
                return connection;
            }
        }
        return connection;
    }
}

// Export singleton pattern convenience methods
export const authService = new AuthService();
