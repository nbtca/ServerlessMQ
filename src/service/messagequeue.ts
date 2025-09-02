import {
	ActiveBroadcastPacket,
	type ActiveBroadcastPacketDataClient,
} from "../types";
import { WebhookPacket } from "../types/packet/webhook";
import { mapHeaders } from "../utils/req";
import { type Client, ClientInstance } from "./client";
import type WebSocketHibernationServer from "./websocketserver";

function fillAddress(client: Client, uuid: string) {
	return (
		(client.headers["cf-connecting-ip"]?.[0] ||
			client.headers["x-forwarded-for"]?.[0]) ??
		uuid
	);
}
export default class MessageQueue {
	constructor(
		private readonly topic: string,
		public server:
			| DurableObjectStub<WebSocketHibernationServer>
			| WebSocketHibernationServer,
	) {}
	async foreachClient(
		callback: (client: ClientInstance) => Promise<void> | void,
	) {
		const clients = await this.server.clients;
		for (const [uuid, clientInfo] of Object.entries(clients)) {
			const result = callback(
				new ClientInstance(
					uuid,
					(data) => this.server.sendToClient(uuid, data),
					clientInfo.headers,
				),
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
		await this.broadcastClientChange();
	}
	async onReceiveMessage(client: ClientInstance, data: ArrayBuffer | string) {
		// Handle incoming message
		if (typeof data === "string") {
			console.log("Received message", this.topic, data);
		}
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
