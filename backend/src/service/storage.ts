import { Kysely, sql } from "kysely";
import { D1Dialect } from "../kysely-durable";
import { checkTable } from "../kysely-durable/database";
import { Str } from "chanfana";
import { z } from "zod";

export interface Env {
	DB: D1Database;
}
export const Channel = z.object({
	id: z.number().int().optional(), // BIGINT PRIMARY KEY AUTO_INCREMENT
	topic_id: z.number().int(), // BIGINT NOT NULL
	name: Str({ example: "channel-name" }), // VARCHAR(255) NOT NULL
	created_at: z.string().optional(), // TIMESTAMP DEFAULT CURRENT_TIMESTAMP
});

export const Message = z.object({
	id: z.number().int(), // BIGINT PRIMARY KEY AUTO_INCREMENT
	topic_id: z.number().int(), // BIGINT NOT NULL
	channel_id: z.number().int(), // BIGINT NOT NULL
	body: Str({ example: "message body" }), // TEXT NOT NULL
	status: z.enum(["pending", "in_flight", "done"]).default("pending"), // ENUM
	attempts: z.number().int().default(0), // INT DEFAULT 0
	delivered_at: z.date().nullable().optional(), // TIMESTAMP NULL
	created_at: z.date(), // TIMESTAMP DEFAULT CURRENT_TIMESTAMP
});

type JoinRequest = z.infer<typeof Message>;
interface Database {
	kv: JoinRequest;
}
export class StorageProvider {
	public readonly db: Kysely<Database>;
	constructor(DB: Pick<SqlStorage, "exec">) {
		const db = new Kysely<Database>({
			dialect: new D1Dialect({ database: DB }),
		});
		this.db = db;
	}
	async checkMessageTable() {
		await checkTable(
			this.db,
			"kv",
			Message,
			{
				id: (col) => col.primaryKey().autoIncrement(),
				created_at: (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`),
			},
			true
		);
	}
	async test() {
		try {
			await this.checkMessageTable();
			const [id] = await this.db
				.insertInto("kv")
				.values({
					topic_id: 1,
					body: "test message",
					channel_id: 1,
					created_at: new Date(),
				})
				.returning("id")
				.execute();

			console.log("Storage test executed", typeof result.created_at);
			const res = await this.db
				.selectFrom("kv")
				.selectAll()
				.where("id", "==", result.id)
				.executeTakeFirst();
			console.log(res.created_at);
			console.log(new Date(res.created_at).toDateString());
			console.log(typeof res.created_at);
		} catch (error) {
			console.error("Storage test failed", error);
		}
	}
}
