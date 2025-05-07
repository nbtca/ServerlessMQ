import type { OpenAPIRouteSchema } from "chanfana";
import { OpenAPIRoute } from "chanfana";
import type { Context } from "../types";
import { getServer } from "../utils";
import { validateRequest as auth } from "../utils/auth";
import { z } from "zod";
export class Websocket extends OpenAPIRoute {
	schema: OpenAPIRouteSchema = {
		tags: ["Websocket"],
		summary: "Connect as a WebSocket client",
		request: {
			params: z.object({
				topic: z.string().min(1).max(100).describe("Topic name"),
			}),
			query: z.object({
				token: z.string().optional().describe("Token for authentication"),
			})
		},
		responses: {
			101: {
				description: "WebSocket connection established",
			},
		},
	};
	async handle(c: Context<"/:topic">) {
		const upgradeHeader = c.req.header("Upgrade");
		if (!upgradeHeader || upgradeHeader !== "websocket") {
			return new Response("Durable Object expected Upgrade: websocket", {
				status: 426,
			});
		}
		const data = await this.getValidatedData<typeof this.schema>();
		const topic = data.params.topic;
		await auth(c, topic);
		console.log("Websocket | ", topic);
		const server = getServer(c);
		return await server.fetch(c.req.raw);
	}
}