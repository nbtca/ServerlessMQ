import { ActiveBroadcastPacket } from "../types";
import type WebSocketHibernationServer from "./websocketserver";
export interface Client {
	headers: Record<string, string>;
}
export class ClientInstance implements Client {
	send(text: string) {
		this.client.send(text);
	}
	constructor(
		public client: WebSocket,
		public headers: Record<string, string>,
	) {}
	// equal
	equals(other: ClientInstance): boolean {
		return this.client === other.client;
	}
}
export default class MessageQueue {
	constructor(
		private readonly topic: string,
		public server:
			| DurableObjectStub<WebSocketHibernationServer>
			| WebSocketHibernationServer,
	) {}
	async onNewClient(client: ClientInstance, request: Request) {
		// Handle new client connection
		console.log("New client connected", this.topic);
		// Send a welcome message to the client
		// await this.server.foreachClient((client) => {
		//   console.log("Sending welcome message to client", client);
		// });
		client.send(
			JSON.stringify({
				topic: this.topic,
				message: "Welcome to the message queue",
				headers: client.headers,
			}),
		);
	}
	onReceiveMessage(client: ClientInstance, data: unknown) {
		// Handle incoming message
		console.log("Received message", this.topic, data);
		// Send a response back to the client
		// client.send(JSON.stringify({ topic: this.topic, data }));
		this.server.foreachClient((target) => {
			if (target.equals(client)) {
				return;
			}
			target.send(
				JSON.stringify({
					from: {
						headers: target.headers,
					},
					topic: this.topic,
					data: data,
				}),
			);
		});
	}
	onClose(client: ClientInstance, code: number, reason: string) {
		// Handle client close
		console.log("Client closed", this.topic, code, reason);
	}
	onWebhookPost(data: unknown) {
		// Handle webhook post
		console.log("Webhook", this.topic, data);
	}
}
