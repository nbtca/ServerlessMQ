import {
	ActiveBroadcastPacket,
	type ActiveBroadcastPacketDataClient,
} from "../types";
import { WebhookPacket } from "../types/packet/webhook";
import { mapHeaders } from "../utils/req";
import { type Client, ClientInstance } from "./client";
import type WebSocketHibernationServer from "./websocketserver";
import { LoggingService } from "./logging";

function fillAddress(client: Client, uuid: string) {
	return (
		(client.headers["cf-connecting-ip"]?.[0] ||
			client.headers["x-forwarded-for"]?.[0]) ??
		uuid
	);
}
export default class MessageQueue {
	private loggingService: LoggingService | null = null;
	private env: any = null;

	constructor(
		private readonly topic: string,
		public server:
			| DurableObjectStub<WebSocketHibernationServer>
			| WebSocketHibernationServer
	) {}

	// Initialize logging service if server has database access
	private initLogging() {
		if (!this.loggingService && this.server && "storageSql" in this.server) {
			// Try to access database through server environment
			// Note: We'll need to pass env through the constructor later
		}
	}

	// Set environment for logging
	setEnvironment(env: any) {
		this.env = env;
		if (env?.ServerlessMQ) {
			this.loggingService = new LoggingService(env.ServerlessMQ);
		}
	}

	// Log event if logging service is available
	private async logEvent(
		event_type:
			| "websocket_connect"
			| "websocket_message"
			| "websocket_disconnect",
		client: ClientInstance,
		data?: any
	) {
		if (!this.loggingService || !this.env) return;

		const clientIP =
			client.headers["cf-connecting-ip"]?.[0] ||
			client.headers["x-forwarded-for"]?.[0] ||
			client.uuid;

		await this.loggingService.logEvent(
			{
				topic: this.topic,
				event_type,
				client_ip: clientIP,
				client_headers: client.headers,
				data: data || {},
			},
			this.env
		);
	}
	async foreachClient(
		callback: (client: ClientInstance) => Promise<void> | void
	) {
		const clients = await this.server.clients;
		for (const [uuid, clientInfo] of Object.entries(clients)) {
			const result = callback(
				new ClientInstance(
					uuid,
					(data) => this.server.sendToClient(uuid, data),
					clientInfo.headers
				)
			);
			if (result) {
				await result;
			}
		}
	}
	async broadcastClientChange() {
		const clients = await this.server.clients;
		const clientsInfo: ActiveBroadcastPacketDataClient[] = [];
		for (const [uuid, clientInfo] of Object.entries(clients)) {
			clientsInfo.push({
				address: fillAddress(clientInfo, uuid),
				headers: clientInfo.headers,
			});
		}
		const pkt = new ActiveBroadcastPacket({
			clients: clientsInfo,
		});
		await this.foreachClient((client) => client.sendPacket(pkt));
	}
	async onNewClient(client: ClientInstance, request: Request) {
		// Handle new client connection
		console.log("New client connected", this.topic);
		await this.logEvent("websocket_connect", client, {
			url: request.url,
			headers: mapHeaders(request.headers),
		});
		await this.broadcastClientChange();
	}
	async onReceiveMessage(client: ClientInstance, data: ArrayBuffer | string) {
		// Handle incoming message
		if (typeof data === "string") {
			console.log("Received message", this.topic, data);
		}
		await this.logEvent("websocket_message", client, {
			message:
				typeof data === "string"
					? data
					: `[Binary data: ${data.byteLength} bytes]`,
			direction: "received",
		});
		// broadcast to all clients except the sender
		await this.foreachClient((target) => {
			if (target.equals(client)) {
				return;
			}
			target.sendRaw(data);
		});
	}
	async onClose(client: ClientInstance, code: number, reason: string) {
		// Handle client close
		console.log("Client closed", this.topic, code, reason);
		await this.logEvent("websocket_disconnect", client, {
			code,
			reason,
		});
		await this.broadcastClientChange();
	}
	async onWebhookPost(req: Request, data: unknown) {
		// console.log("this.server.storage.list()", await this.server.storage.list());
		// Handle webhook post
		console.log("Webhook", this.topic, data);
		try {
			const pkt = new WebhookPacket({
				body: data,
				headers: mapHeaders(req.headers),
				method: req.method,
				topic: this.topic,
				url: req.url,
			});
			// broadcast to all clients
			const pktStr = JSON.stringify(pkt);
			let count = 0;
			await this.foreachClient((client) => {
				client.sendRaw(pktStr);
				count++;
			});
			return count;
		} catch (error) {
			console.log(error);
			return 0;
		}
	}
	async onError(client: ClientInstance, error: unknown) {
		console.error("WebSocket error:", error);
	}
}
