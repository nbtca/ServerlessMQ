export interface LogEntry {
	id?: number;
	topic: string;
	event_type:
		| "webhook"
		| "websocket_connect"
		| "websocket_message"
		| "websocket_disconnect";
	timestamp?: string;
	client_ip?: string;
	client_headers?: Record<string, string | string[]>;
	data?: any;
	created_at?: string;
}

export interface LogQueryOptions {
	topic: string;
	limit?: number;
	offset?: number;
	event_type?: string;
	start_time?: string;
	end_time?: string;
}

export class LoggingService {
	constructor(private db: D1Database) {}

	// Check if logging is enabled for a topic
	private isLoggingEnabled(topic: string, env: any): boolean {
		const logEnvKey = `TOPIC_${topic.toUpperCase()}`;
		return env[logEnvKey] === "true" || env[logEnvKey] === true;
	}

	// Initialize database schema
	async initDatabase(): Promise<void> {
		const createTableSQL =
			"CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT NOT NULL, event_type TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, client_ip TEXT, client_headers TEXT, data TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)";

		const createIndexesSQL = [
			"CREATE INDEX IF NOT EXISTS idx_logs_topic ON logs(topic)",
			"CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)",
			"CREATE INDEX IF NOT EXISTS idx_logs_topic_timestamp ON logs(topic, timestamp)",
			"CREATE INDEX IF NOT EXISTS idx_logs_event_type ON logs(event_type)",
		];

		await this.db.exec(createTableSQL);
		for (const indexSQL of createIndexesSQL) {
			await this.db.exec(indexSQL);
		}
	}

	// Log an event if logging is enabled for the topic
	async logEvent(entry: LogEntry, env: any): Promise<void> {
		if (!this.isLoggingEnabled(entry.topic, env)) {
			return;
		}

		try {
			const stmt = this.db.prepare(
				`INSERT INTO logs (topic, event_type, client_ip, client_headers, data) VALUES (?, ?, ?, ?, ?)`
			);

			await stmt
				.bind(
					entry.topic,
					entry.event_type,
					entry.client_ip || null,
					entry.client_headers ? JSON.stringify(entry.client_headers) : null,
					entry.data ? JSON.stringify(entry.data) : null
				)
				.run();
		} catch (error) {
			console.error("Failed to log event:", error);
		}
	}

	// Retrieve logs for a topic
	async getLogs(options: LogQueryOptions): Promise<LogEntry[]> {
		let sql = `SELECT id, topic, event_type, timestamp, client_ip, client_headers, data, created_at FROM logs WHERE topic = ?`;
		const params: any[] = [options.topic];

		if (options.event_type) {
			sql += " AND event_type = ?";
			params.push(options.event_type);
		}

		if (options.start_time) {
			sql += " AND timestamp >= ?";
			params.push(options.start_time);
		}

		if (options.end_time) {
			sql += " AND timestamp <= ?";
			params.push(options.end_time);
		}

		sql += " ORDER BY timestamp DESC";

		if (options.limit) {
			sql += " LIMIT ?";
			params.push(options.limit);
		}

		if (options.offset) {
			sql += " OFFSET ?";
			params.push(options.offset);
		}

		const stmt = this.db.prepare(sql);
		const result = await stmt.bind(...params).all();

		return result.results.map((row: any) => ({
			id: row.id,
			topic: row.topic,
			event_type: row.event_type,
			timestamp: row.timestamp,
			client_ip: row.client_ip,
			client_headers: row.client_headers
				? JSON.parse(row.client_headers)
				: null,
			data: row.data ? JSON.parse(row.data) : null,
			created_at: row.created_at,
		}));
	}

	// Get log count for a topic
	async getLogCount(topic: string, event_type?: string): Promise<number> {
		let sql = "SELECT COUNT(*) as count FROM logs WHERE topic = ?";
		const params: any[] = [topic];

		if (event_type) {
			sql += " AND event_type = ?";
			params.push(event_type);
		}

		const stmt = this.db.prepare(sql);
		const result = await stmt.bind(...params).first();
		return result?.count || 0;
	}

	// Validate topic password
	validateTopicPassword(topic: string, password: string, env: any): boolean {
		const passwordEnvKey = `TOPIC_${topic.toUpperCase()}_PASSWORD`;
		const expectedPassword = env[passwordEnvKey];
		return expectedPassword && expectedPassword === password;
	}
}
