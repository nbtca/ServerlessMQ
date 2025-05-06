import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Scalar } from "@scalar/hono-api-reference";
import { Webhook } from "./endpoints/webhook";
import { Websocket } from "./endpoints/websocket";
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
			{ status: 400 },
		);
	}
	return Response.json(
		{
			error: "Internal Server Error",
			message: err.message,
			// stack: err.stack,
		},
		{ status: 500 },
	);
});
// This is a workaround for the CORS issue
app.use("*", async (c, next) => {
	c.res.headers.set("Access-Control-Allow-Origin", "*");
	c.res.headers.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, OPTIONS",
	);
	c.res.headers.set(
		"Access-Control-Allow-Headers",
		"Content-Type, Authorization",
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
	redoc_url: "docs",
});
app.get("/", Scalar({ url: openapiUrl }));
openapi.post("/:topic", Webhook);
openapi.get("/:topic", Websocket);
export default app;
export { WebSocketServer };
