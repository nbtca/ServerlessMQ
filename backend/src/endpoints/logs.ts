import { OpenAPIRoute } from "chanfana";
import type { Context } from "../types";
import { z } from "zod";
import { LoggingService } from "../service/logging";

export class LogsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Logs"],
		summary: "Get Topic Logs",
		request: {
			params: z.object({
				topic: z.string().min(1).max(100).describe("Topic name"),
			}),
			query: z.object({
				password: z.string().describe("Topic password for authentication"),
				event_type: z.string().optional().describe("Filter by event type"),
				limit: z.coerce
					.number()
					.min(1)
					.max(1000)
					.default(100)
					.describe("Number of logs to return"),
				offset: z.coerce
					.number()
					.min(0)
					.default(0)
					.describe("Offset for pagination"),
				start_time: z.string().optional().describe("Start time in ISO format"),
				end_time: z.string().optional().describe("End time in ISO format"),
			}),
		},
		responses: {
			"200": {
				description: "Returns topic logs",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							logs: z.array(
								z.object({
									id: z.number(),
									topic: z.string(),
									event_type: z.string(),
									timestamp: z.string(),
									client_ip: z.string().nullable(),
									client_headers: z.any().nullable(),
									data: z.any().nullable(),
									created_at: z.string(),
								})
							),
							total_count: z.number(),
							pagination: z.object({
								limit: z.number(),
								offset: z.number(),
								has_more: z.boolean(),
							}),
						}),
					},
				},
			},
			"401": {
				description: "Unauthorized - invalid topic password",
				content: {
					"application/json": {
						schema: z.object({
							error: z.string(),
							message: z.string(),
						}),
					},
				},
			},
			"403": {
				description: "Forbidden - logging not enabled for topic",
				content: {
					"application/json": {
						schema: z.object({
							error: z.string(),
							message: z.string(),
						}),
					},
				},
			},
		},
	};

	async handle(c: Context<"/:topic">) {
		const data = await this.getValidatedData<typeof this.schema>();
		const topic = data.params.topic;
		const { password, event_type, limit, offset, start_time, end_time } =
			data.query;

		if (!c.env.ServerlessMQ) {
			return Response.json(
				{
					error: "Database not available",
					message: "Database connection is not configured",
				},
				{ status: 500 }
			);
		}

		const loggingService = new LoggingService(c.env.ServerlessMQ);

		// Validate topic password
		if (!loggingService.validateTopicPassword(topic, password, c.env)) {
			return Response.json(
				{
					error: "Unauthorized",
					message: "Invalid topic password",
				},
				{ status: 401 }
			);
		}

		// Check if logging is enabled for this topic
		const logEnvKey = `TOPIC_${topic.toUpperCase()}`;
		if (c.env[logEnvKey] !== "true" && c.env[logEnvKey] !== true) {
			return Response.json(
				{
					error: "Forbidden",
					message: "Logging is not enabled for this topic",
				},
				{ status: 403 }
			);
		}

		try {
			// Initialize database if needed
			await loggingService.initDatabase();

			// Get logs
			const logs = await loggingService.getLogs({
				topic,
				event_type,
				limit,
				offset,
				start_time,
				end_time,
			});

			// Get total count
			const totalCount = await loggingService.getLogCount(topic, event_type);

			return {
				success: true,
				logs,
				total_count: totalCount,
				pagination: {
					limit,
					offset,
					has_more: offset + limit < totalCount,
				},
			};
		} catch (error) {
			console.error("Error retrieving logs:", error);
			return Response.json(
				{
					error: "Internal Server Error",
					message: "Failed to retrieve logs",
				},
				{ status: 500 }
			);
		}
	}
}
