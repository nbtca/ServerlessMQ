import { OpenAPIRoute } from "chanfana";
import type { Context } from "../types";
import { z } from "zod";
import { validateRequest as auth } from "../utils/auth";
import { getMQ } from "../utils";
import { LoggingService } from "../service/logging";
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
						schema: z.unknown(),
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
		// Get topic from URL params first (before consuming request body)
		const topic = c.req.param("topic");
		if (!topic) {
			return c.json({ error: "Topic is required" }, 400);
		}

		// Validate authentication before consuming the request body
		// This is crucial because signature validation needs the raw request body,
		// but getValidatedData() consumes and caches the body stream
		await auth(c, topic);

		// Now we can safely get validated data
		const data = await this.getValidatedData<typeof this.schema>();
		const body = await data.body;
		const mq = getMQ(c);
		const count = await mq.onWebhookPost(c.req.raw, body);

		// Log webhook event if logging is enabled for this topic
		if (c.env.ServerlessMQ) {
			const loggingService = new LoggingService(c.env.ServerlessMQ);
			const clientIP =
				c.req.header("cf-connecting-ip") ||
				c.req.header("x-forwarded-for") ||
				"";
			const headers: Record<string, string | string[]> = {};
			c.req.raw.headers.forEach((value, key) => {
				headers[key] = value;
			});

			await loggingService.logEvent(
				{
					topic,
					event_type: "webhook",
					client_ip: clientIP,
					client_headers: headers,
					data: {
						method: c.req.method,
						url: c.req.url,
						body: body,
						count: count,
					},
				},
				c.env
			);
		}

		return {
			success: true,
			count,
		};
	}
}
