import { Bool, OpenAPIRoute } from "chanfana";
import { Context, HttpError } from "../types";
import { z } from "zod";
import { validatePost } from "../utils/auth";
import { getServer } from "../utils";
export class Webhook extends OpenAPIRoute {
	schema = {
		tags: ["Webhook"],
		summary: "Push Webhook Message",
		request: {
			params: z.object({
				topic: z.string().min(1).max(100).describe("Topic name"),
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
		// Get validated data
		const data = await this.getValidatedData<typeof this.schema>();
		// Retrieve the validated request body
		const body = data.body;
		// Implement your own object insertion here
		const topic = c.req.param("topic");
		console.log("Webhook", topic, body);
		await validatePost(c, topic);
		const server = getServer(c);
		return {};
	}
}
