import crypto from "node:crypto";

/**
 * Base64URL-encode a Buffer as defined in RFC 7636.
 */
export function base64URLEncode(buffer: Buffer): string {
    return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generates a random PKCE code verifier.
 */
export function generateCodeVerifier(length = 64): string {
    return base64URLEncode(crypto.randomBytes(length));
}

/**
 * Calculates the PKCE code challenge given a code verifier.
 */
export function generateCodeChallenge(verifier: string): string {
    const hash = crypto.createHash("sha256").update(verifier).digest();
    return base64URLEncode(hash);
}

/**
 * Generates a random state string to mitigate CSRF attacks.
 */
export function generateState(length = 32): string {
    return base64URLEncode(crypto.randomBytes(length));
}
