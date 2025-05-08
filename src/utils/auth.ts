import type { HonoRequest } from "hono";
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
function tryGetToken(env: Env, topic: string): string | undefined {
	return getEnvCaseInsensitive(env, `TOKEN_${topic}`) ?? env.GLOBAL_TOKEN;
}
function tryGetSecret(env: Env, topic: string): string | undefined {
	return getEnvCaseInsensitive(env, `SECRET_${topic}`) ?? env.GLOBAL_SECRET;
}
function getToken(env: Env, topic: string): string {
	const secret = tryGetToken(env, topic);
	if (!secret) {
		throw new HttpError("Missing webhook token in environment variables", 500);
	}
	return secret;
}
function getSecret(env: Env, topic: string): string {
	const secret = tryGetSecret(env, topic);
	if (!secret) {
		throw new HttpError("Missing webhook secret in environment variables", 500);
	}
	return secret;
}
function tryGetAuthTokenFromRequest(req: HonoRequest<string, unknown>) {
	return (
		req.header("Authorization")?.split(" ")[1] ??
		req.header("X-Auth-Token") ??
		req.query("token")
	);
}
async function validateToken(ctx: Context, topic: string) {
	const { req, env } = ctx;
	const token = tryGetAuthTokenFromRequest(req);
	if (!token) {
		throw new HttpError("Missing Authorization header", 401);
	}
	const requiredToken = getToken(env, topic);
	// Check if the token matches the required token
	if (token !== requiredToken) {
		throw new HttpError("Invalid token", 401);
	}
}
function tryGetSignatureFromRequest(req: HonoRequest<string, unknown>) {
	const hubSignature = req.header("X-Hub-Signature-256");
	if (hubSignature) {
		return hubSignature;
	}
	const allHeaders = req.header();
	for (const key in allHeaders) {
		// all like X-*-Signature-256, case insensitive
		if (key.toLowerCase().endsWith("-signature-256")) {
			return allHeaders[key];
		}
	}
}
/**
 * Validates a webhook request from GitHub by verifying the signature
 * @param ctx The context object containing request and environment
 * @returns True if validation passes, throws an error if validation fails
 */
async function validateSignature(ctx: Context, topic: string) {
	const { req, env } = ctx;
	// Get the signature from the request headers
	const signature = tryGetSignatureFromRequest(req);
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

async function validateRequest(
	ctx: Context,
	topic: string,
	getBody?: () => Promise<string>,
) {
	const { req, env } = ctx;
	if (req.method === "GET") {
		// get has no 'body' so only validate token
		await validateToken(ctx, topic);
		return;
	}
	const secret = tryGetSecret(env, topic);
	const token = tryGetToken(env, topic);
	if (!secret && !token) {
		throw new HttpError(
			"Missing webhook secret and token in environment variables",
			500,
		);
	}
	const reqToken = tryGetAuthTokenFromRequest(req);
	const reqSignature = tryGetSignatureFromRequest(req);
	if (reqToken && token) {
		if (reqToken === token) {
			// token is set and request has the same token
			return; // Token is valid, pass
		}
		throw new HttpError("Token mismatch", 401);
	}
	if (reqSignature && secret) {
		// secret is set and request has valid sha signature using the secret
		if (
			await verifySignature(secret, reqSignature, await (getBody ?? req.text)())
		) {
			return; // Signature is valid, pass
		}
		throw new HttpError("Signature mismatch", 401);
	}
	if (!reqToken && !reqSignature) {
		throw new HttpError(
			"Missing Authorization header or X-*-Signature-256 header in request",
			401,
		);
	}
	throw new HttpError("Internal server error: validateRequest", 500);
}
export { validateSignature, validateToken, validateRequest };
