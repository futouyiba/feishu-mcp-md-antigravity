import { createServer, Server } from "node:http";
import { parse as parseUrl } from "node:url";

export interface OAuthCallbackParams {
    code: string;
    state: string;
}

export class LocalOAuthServer {
    private server: Server | null = null;
    private currentPort: number;

    constructor(port = 8080) {
        this.currentPort = port;
    }

    get port(): number {
        return this.currentPort;
    }

    get redirectUri(): string {
        return `http://localhost:${this.currentPort}/callback`;
    }

    /**
     * Starts an HTTP server on the given port and waits for the incoming OAuth redirect.
     */
    waitForCallback(expectedState?: string): Promise<OAuthCallbackParams> {
        return new Promise((resolve, reject) => {
            this.server = createServer((req, res) => {
                try {
                    if (!req.url) {
                        res.writeHead(400);
                        res.end("Bad Request");
                        return;
                    }

                    const parsedUrl = parseUrl(req.url, true);

                    if (parsedUrl.pathname === "/callback") {
                        const code = parsedUrl.query.code as string | undefined;
                        const state = parsedUrl.query.state as string | undefined;
                        const error = parsedUrl.query.error as string | undefined;

                        if (error) {
                            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
                            res.end(`<h1>授权失败: ${error}</h1><p>您可以关闭此窗口返回终端。</p>`);
                            this.stop();
                            return reject(new Error(`OAuth Error from Provider: ${error}`));
                        }

                        if (!code || !state) {
                            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
                            res.end(`<h1>参数缺失</h1><p>缺少 code 或 state。您可以关闭此窗口返回终端。</p>`);
                            this.stop();
                            return reject(new Error("Missing code or state from callback."));
                        }

                        if (expectedState && state !== expectedState) {
                            res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
                            res.end(`<h1>CSRF 警告</h1><p>State 参数不匹配该会话。您可以关闭此窗口返回终端。</p>`);
                            this.stop();
                            return reject(new Error("State mismatch. Potential CSRF attack."));
                        }

                        // Success
                        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                        res.end(`<h1>授权成功！</h1><p>您已成功登录。现在可以关闭此窗口返回终端。</p>`);

                        this.stop();
                        resolve({ code, state });
                    } else {
                        res.writeHead(404);
                        res.end("Not Found");
                    }
                } catch (err) {
                    this.stop();
                    reject(err);
                }
            });

            this.server.on("error", (err: any) => {
                // If port in use, user may need to specify alternative, but here we just error out.
                reject(new Error(`Local server failed to start on port ${this.currentPort}: ${err.message}`));
            });

            this.server.listen(this.currentPort, "localhost", () => {
                // Ready
            });
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}
