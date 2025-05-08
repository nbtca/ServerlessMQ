import { OpenAPIRoute } from "chanfana";
import type { Context } from "../types";
import { z } from "zod";
import { validateRequest as auth } from "../utils/auth";
import { getMQ } from "../utils";
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
			body: {
				content: {
					"application/json": {
						//any json data
						schema: z.object({}),
					},
				},
			},
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
		const body = data.body;
		const topic = data.params.topic;
		await auth(c, topic, c.req.text);
		console.log("Webhook | ", topic, body);
		const mq = getMQ(c);
		mq.onWebhookPost(body);
		return {
			success: true,
		};
	}
}
