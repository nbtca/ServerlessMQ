import {
	ActiveBroadcastPacket,
	type ActiveBroadcastPacketDataClient,
	type Packet,
} from "../types";
import type WebSocketHibernationServer from "./websocketserver";
export type HeadersType = Record<string, string[]>;
export interface Client {
	headers: HeadersType;
}
export class ClientInstance implements Client {
	sendRaw(data: ArrayBuffer | string) {
		this.client.send(data);
	}
	sendUnknown(pkt: unknown) {
		this.sendRaw(JSON.stringify(pkt));
	}
	sendPacket(pkt: Packet) {
		this.sendRaw(JSON.stringify(pkt));
	}
	constructor(
		public uuid: string,
		public client: WebSocket,
		public headers: HeadersType,
	) {}
	equals(other: ClientInstance): boolean {
		return this.uuid === other.uuid;
	}
}
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
	async broadcastClientChange() {
		const clients = await this.server.clients;
		const clientsInfo: ActiveBroadcastPacketDataClient[] = [];
		for (const [uuid, clientInfo] of clients.entries()) {
			clientsInfo.push({
				address: fillAddress(clientInfo, uuid),
				headers: clientInfo.headers,
			});
		}
		const pkt = new ActiveBroadcastPacket({
			clients: clientsInfo,
		});
		await this.server.foreachClient((client) => {
			client.sendPacket(pkt);
		});
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
		await this.server.foreachClient((target) => {
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
	onWebhookPost(data: unknown) {
		// Handle webhook post
		console.log("Webhook", this.topic, data);
	}
}
