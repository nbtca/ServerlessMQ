import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Scalar } from "@scalar/hono-api-reference";
import { Webhook } from "./endpoints/webhook";
import { Websocket } from "./endpoints/websocket";
import { LogsEndpoint } from "./endpoints/logs";
import WebSocketServer from "./service/websocketserver";
import { HttpError } from "./types";
import { getServer } from "./utils";
import { ZodError } from "zod";

const app = new Hono<{ Bindings: Env }>();
// Process the error and return a response
app.onError(async (err, c) => {
	if (err instanceof HttpError) {
		return err.getResponse();
	}
	if (err instanceof ZodError) {
		return Response.json(
			{
				error: "Invalid request",
				message: err.errors,
			},
			{ status: 400 }
		);
	}
	console.error(err);
	return Response.json(
		{
			error: "Internal Server Error",
			message: err.message,
			stack: err.stack,
		},
		{ status: 500 }
	);
});
// This is a workaround for the CORS issue
app.use("*", async (c, next) => {
	c.res.headers.set("Access-Control-Allow-Origin", "*");
	c.res.headers.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, OPTIONS"
	);
	c.res.headers.set(
		"Access-Control-Allow-Headers",
		"Content-Type, Authorization"
	);
	if (c.req.method === "OPTIONS") {
		return c.newResponse("OK", 200, {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		});
	}
	await next();
});
// Setup OpenAPI registry
const openapiUrl = "openapi.json";
const openapi = fromHono(app, {
	openapi_url: openapiUrl,
	docs_url: null,
	redoc_url: "redoc",
});

// API documentation route
app.get("/docs", Scalar({ url: openapiUrl }));

// API routes
openapi.post("/:topic", Webhook);
openapi.get("/:topic", Websocket);
openapi.get("/ws/:topic", Websocket);
openapi.get("/:topic/logs", LogsEndpoint);

// Serve static files - handle root path and static assets
app.get("/", async (c) => {
	try {
		// Try to get the index.html from the assets binding
		if (c.env.ASSETS) {
			const indexHtml = await c.env.ASSETS.fetch(
				new Request("https://example.com/index.html")
			);
			if (indexHtml.ok) {
				return new Response(await indexHtml.text(), {
					headers: { "Content-Type": "text/html" },
				});
			}
		}
	} catch (error) {
		console.log("Assets not available in development:", error);
	}

	// Fallback to API documentation in development
	return c.html(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>ServerlessMQ</title>
			<meta charset="UTF-8">
		</head>
		<body>
			<h1>ServerlessMQ</h1>
			<p>Frontend not available in development mode.</p>
			<p><a href="/docs">View API Documentation</a></p>
		</body>
		</html>
	`);
});

// Serve other static assets
app.get("/assets/*", async (c) => {
	try {
		if (c.env.ASSETS) {
			const url = new URL(c.req.url);
			const assetResponse = await c.env.ASSETS.fetch(
				new Request(`https://example.com${url.pathname}`)
			);
			if (assetResponse.ok) {
				return assetResponse;
			}
		}
	} catch (error) {
		console.log("Asset not found:", error);
	}
	return c.notFound();
});
export default app;
export { WebSocketServer };
