import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "../src/auth/pkce.js";
import { OpenAIAuthProvider } from "../src/auth/providers/openai.js";
import { GoogleAuthProvider } from "../src/auth/providers/google.js";
import { AuthService } from "../src/auth/service.js";
import { AuthConnection, AuthStore } from "../src/auth/types.js";

// Mock store
class MockAuthStore implements AuthStore {
    connections: AuthConnection[] = [];

    async getConnection(userId: string, provider: string) {
        return this.connections.find(c => c.userId === userId && c.provider === provider) || null;
    }
    async saveConnection(connection: AuthConnection) {
        this.connections = this.connections.filter(c => !(c.userId === connection.userId && c.provider === connection.provider));
        this.connections.push(connection);
    }
    async deleteConnection(userId: string, provider: string) {
        this.connections = this.connections.filter(c => !(c.userId === userId && c.provider === provider));
    }
    async listConnections(userId: string) {
        return this.connections.filter(c => c.userId === userId);
    }
}

describe("PKCE & State Generation", () => {
    it("should generate valid PKCE strings", () => {
        const verifier = generateCodeVerifier();
        expect(verifier.length).toBeGreaterThan(40);
        expect(verifier).toMatch(/^[A-Za-z0-9\-\_\~\.]+$/); // Simplified Base64URL check

        const challenge = generateCodeChallenge(verifier);
        expect(challenge.length).toBeGreaterThan(0);
        expect(challenge).not.toEqual(verifier); // Should be hashed
    });

    it("should generate random states", () => {
        const s1 = generateState();
        const s2 = generateState();
        expect(s1).not.toEqual(s2);
    });
});

describe("OpenAI Provider", () => {
    let provider: OpenAIAuthProvider;

    beforeEach(() => {
        provider = new OpenAIAuthProvider();
        global.fetch = vi.fn();
    });

    it("should generate valid startLogin URL with PKCE and state", () => {
        const url = provider.startLogin("test-state", "test-challenge", "http://localhost/cb");
        expect(url).toContain("state=test-state");
        expect(url).toContain("code_challenge=test-challenge");
        expect(url).toContain("code_challenge_method=S256");
    });

    it("should handle handleCallback and return a connection", async () => {
        const mockRes = {
            ok: true,
            json: async () => ({
                access_token: "test-access",
                refresh_token: "test-refresh",
                expires_in: 3600,
                scope: "read write"
            })
        };
        (global.fetch as any).mockResolvedValue(mockRes);

        const result = await provider.handleCallback("mock-code", "mock-verifier", "http://cb");
        expect(result.accessToken).toBe("test-access");
        expect(result.refreshToken).toBe("test-refresh");
        expect(result.scopes).toEqual(["read", "write"]);

        // Check that we submitted the right parameters in fetch
        const fetchCall = (global.fetch as any).mock.calls[0];
        const bodyStr = fetchCall[1].body;
        expect(bodyStr).toContain("grant_type=authorization_code");
        expect(bodyStr).toContain("code=mock-code");
        expect(bodyStr).toContain("code_verifier=mock-verifier");
    });

    it("should inject authorization headers correctly", () => {
        const req: any = { headers: {} };
        provider.injectAuth(req, { accessToken: "token123", accountId: "org-1" } as any);
        expect(req.headers["Authorization"]).toBe("Bearer token123");
        expect(req.headers["OpenAI-Organization"]).toBe("org-1");
    });
});

describe("AuthService E2E (Refresh & Injection)", () => {
    let mockStore: MockAuthStore;
    let service: AuthService;

    beforeEach(() => {
        mockStore = new MockAuthStore();
        service = new AuthService(mockStore);
        global.fetch = vi.fn();
    });

    it("should correctly pull connection from store and inject auth", async () => {
        await mockStore.saveConnection({
            userId: "local",
            provider: "google",
            accessToken: "g-token-active",
            expiresAt: Date.now() + 1000 * 60 * 60, // 1 hour left
            scopes: []
        });

        const mockReq = { headers: {} };
        await service.injectAuth("google", mockReq);
        expect(mockReq.headers["Authorization"]).toBe("Bearer g-token-active");
    });

    it("should automatically refresh token if nearing expiration", async () => {
        await mockStore.saveConnection({
            userId: "local",
            provider: "google",
            accessToken: "g-token-expiring",
            refreshToken: "g-refresh-token",
            expiresAt: Date.now() + 1000 * 30, // 30 seconds left (< 2 min threshold)
            scopes: []
        });

        // Mock the refresh API call
        const mockRes = {
            ok: true,
            json: async () => ({
                access_token: "g-token-NEW",
                refresh_token: "g-refresh-token", // some providers don't rotate
                expires_in: 3600
            })
        };
        (global.fetch as any).mockResolvedValue(mockRes);

        const mockReq = { headers: {} };
        await service.injectAuth("google", mockReq);

        // Should have refreshed the token and used the new one
        expect(mockReq.headers["Authorization"]).toBe("Bearer g-token-NEW");

        // Verify it updated the store
        const updated = await mockStore.getConnection("local", "google");
        expect(updated?.accessToken).toBe("g-token-NEW");
        expect(updated?.expiresAt).toBeGreaterThan(Date.now() + 1000 * 3000);
    });
});
