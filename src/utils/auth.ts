import type { Context } from "../types";
import { HttpError } from "../types";
function getEnvCaseInsensitive(env: Env, key: string): string | undefined {
	const lowerKey = key.toLowerCase();
	for (const [k, v] of Object.entries(env)) {
		if (k.toLowerCase() === lowerKey) {
			return v;
		}
	}
	return undefined;
}
function getToken(env: Env, topic: string): string {
	const secret =
		getEnvCaseInsensitive(env, `TOKEN_${topic}`) ?? env.GLOBAL_TOKEN;
	if (!secret) {
		throw new HttpError("Missing webhook token in environment variables", 500);
	}
	return secret;
}
function getSecret(env: Env, topic: string): string {
	const secret =
		getEnvCaseInsensitive(env, `SECRET_${topic}`) ?? env.GLOBAL_SECRET;
	if (!secret) {
		throw new HttpError("Missing webhook secret in environment variables", 500);
	}
	return secret;
}
async function validateToken(ctx: Context, topic: string) {
	const { req, env } = ctx;
	const authorization = req.header("Authorization");
	let token = authorization?.split(" ")[1];
	if (!token) {
		token = ctx.req.param("token");
	}
	if (!token) {
		throw new HttpError("Missing Authorization header", 401);
	}
	const requiredToken = getToken(env, topic);
	// Check if the token matches the required token
	if (token !== requiredToken) {
		throw new HttpError("Invalid token", 401);
	}
	return true;
}
/**
 * Validates a webhook request from GitHub by verifying the signature
 * @param ctx The context object containing request and environment
 * @returns True if validation passes, throws an error if validation fails
 */
async function validateSignature(ctx: Context, topic: string) {
	const { req, env } = ctx;
	// Get the signature from the request headers
	const signature = req.header()["X-Hub-Signature-256"];
	if (!signature) {
		throw new HttpError("Missing X-*-Signature-256 header", 401);
	}
	// Get the webhook secret from environment variables
	const webhookSecret = getSecret(env, topic);
	// Get the raw request body
	const payload = await req.text();
	// Verify the signature
	const isValid = await verifySignature(webhookSecret, signature, payload);
	if (!isValid) {
		throw new HttpError("Webhook signature verification failed", 401);
	}
	return true;
}

/**
 * Verifies the HMAC SHA-256 signature of the webhook payload
 * https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 * @param secret The webhook secret
 * @param signature The signature from the X-Hub-Signature-256 header
 * @param payload The raw request payload
 * @returns True if the calculated signature matches the provided signature
 */
async function verifySignature(
	secret: string,
	signature: string,
	payload: string,
): Promise<boolean> {
	// The signature starts with "sha256="
	const sigParts = signature.split("=");
	if (sigParts.length !== 2 || sigParts[0] !== "sha256") {
		return false;
	}
	const sigHex = sigParts[1];
	// Create an encoder for the text
	const encoder = new TextEncoder();
	// Import the secret as a crypto key
	const keyData = encoder.encode(secret);
	const algorithm = { name: "HMAC", hash: { name: "SHA-256" } };
	const key = await crypto.subtle.importKey("raw", keyData, algorithm, false, [
		"sign",
	]);
	// Sign the payload
	const payloadData = encoder.encode(payload);
	const mac = await crypto.subtle.sign("HMAC", key, payloadData);
	// Convert the signature to hex
	const calculatedSigBytes = new Uint8Array(mac);
	const calculatedSigHex = Array.from(calculatedSigBytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	// Use a constant-time comparison to prevent timing attacks
	return timingSafeEqual(sigHex, calculatedSigHex);
}

/**
 * Performs a constant-time comparison of two strings to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns True if the strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

export { validateSignature as validatePost, validateToken as validateGet };
