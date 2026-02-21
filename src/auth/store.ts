import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { AuthConnection, AuthStore } from "./types.js";

const DEFAULT_AUTH_DIR = path.join(os.homedir(), ".feishu-mcp");
const DEFAULT_AUTH_FILE = path.join(DEFAULT_AUTH_DIR, "auth.json");

export class FileAuthStore implements AuthStore {
    private filePath: string;

    constructor(filePath: string = DEFAULT_AUTH_FILE) {
        this.filePath = filePath;
    }

    private async ensureDir(): Promise<void> {
        const dir = path.dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });
    }

    private async readAll(): Promise<AuthConnection[]> {
        try {
            const data = await fs.readFile(this.filePath, "utf-8");
            return JSON.parse(data) as AuthConnection[];
        } catch (err: any) {
            if (err.code === "ENOENT") {
                return [];
            }
            throw err;
        }
    }

    private async writeAll(connections: AuthConnection[]): Promise<void> {
        await this.ensureDir();
        // Restrict permissions so only the owner can read/write the token file
        await fs.writeFile(this.filePath, JSON.stringify(connections, null, 2), {
            encoding: "utf-8",
            mode: 0o600,
        });
    }

    async getConnection(userId: string, provider: string): Promise<AuthConnection | null> {
        const all = await this.readAll();
        return all.find((c) => c.userId === userId && c.provider === provider) || null;
    }

    async saveConnection(connection: AuthConnection): Promise<void> {
        const all = await this.readAll();
        const index = all.findIndex((c) => c.userId === connection.userId && c.provider === connection.provider);

        if (index >= 0) {
            all[index] = connection; // Update
        } else {
            all.push(connection); // Insert
        }

        await this.writeAll(all);
    }

    async deleteConnection(userId: string, provider: string): Promise<void> {
        const all = await this.readAll();
        const filtered = all.filter((c) => !(c.userId === userId && c.provider === provider));
        await this.writeAll(filtered);
    }

    async listConnections(userId: string): Promise<AuthConnection[]> {
        const all = await this.readAll();
        return all.filter((c) => c.userId === userId);
    }
}
