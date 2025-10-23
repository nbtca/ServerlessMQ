import { OpenAPIRoute } from "chanfana";
import type { Context } from "../types";
import { z } from "zod";
import { validateRequest } from "../utils/auth";
import { getServer } from "../utils";
export class Webhook extends OpenAPIRoute {
	schema = {
		tags: ["Webhook"],
		summary: "Push Webhook Message",
		request: {
			params: z.object({
				topic: z.string().min(1).max(100).describe("Topic name"),
			}),
			query: z.object({
				token: z.string().optional().describe("Token for authentication"),
			}),
		},
		responses: {
			"200": {
				description: "返回Webhook提交结果",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
						}),
					},
				},
			},
		},
	};
	async handle(c: Context<"/:topic">) {
		const data = await this.getValidatedData<typeof this.schema>();
		const topic = data.params.topic;
		await validateRequest(c, topic);
		const server = getServer(c);
		const body = await c.req.json();
		const cr = c.req.raw;
		const count = await server.processWebhookPost(
			{
				headers: cr.headers,
				method: cr.method,
				url: cr.url,
			},
			body
		);
		return {
			success: true,
			count,
		};
	}
}
