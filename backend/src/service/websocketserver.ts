import { DurableObject } from "cloudflare:workers";
import MessageQueue from "./messagequeue";
import { ClientInstance } from "./client";
import type { Client as ClientInfo } from "./client";
import { extractTopicFromPath } from "../utils";
import { mapHeaders } from "../utils/req";
export class WebSocketHibernationServer extends DurableObject<Env> {
	private _topic: string;
	public get topic() {
		return this._topic;
	}
	public get mq() {
		return new MessageQueue(this.topic, this);
	}
	async storageSql(query: string, ...bindings: unknown[]) {
		return this.ctx.storage.sql.exec(query, ...bindings);
	}
	get clients(): Record<string, ClientInfo> {
		// return this.clientsList;
		const clients: Record<string, ClientInfo> = {};
		for (const ws of this.ctx.getWebSockets()) {
			const id = this.getIdFromClient(ws);
			clients[id] = ws.deserializeAttachment();
		}
		return clients;
	}
	// private clientsList: Record<string, ClientInfo> = {};
	onNewClient(id: string, info: ClientInfo) {
		// this.clientsList[id] = info;
		const client = this.getWebsocketClient(id);
		client.serializeAttachment(info);
	}
	onRemoveClient(id: string) {
		// delete this.clientsList[id];
	}
	getInfoFromId(id: string): ClientInfo {
		const info = this.clients[id];
		if (info) {
			return info;
		}
		console.log(this.clients);
		throw new Error(`[getInfoFromId] WebSocket ${id} not found`);
	}
	private readonly idPrefix: string = "websocket_";
	generateNewId() {
		return `${this.idPrefix}${crypto.randomUUID()}`;
	}
	getWebsocketClient(id: string): WebSocket {
		for (const ws of this.ctx.getWebSockets(id)) {
			return ws;
		}
		console.log(this.clients);
		throw new Error(`[getWebsocketClient] WebSocket ${id} not found`);
	}
	getIdFromClient(client: WebSocket): string {
		for (const tag of this.ctx.getTags(client)) {
			if (tag.startsWith(this.idPrefix)) {
				return tag;
			}
		}
		console.log(this.clients);
		throw new Error("Client not found: missing websocket tag");
	}
	async sendToClient(uuid: string, data: ArrayBuffer | string) {
		const ws = this.getWebsocketClient(uuid);
		if (ws) {
			ws.send(data);
		} else {
			throw new Error(`Client ${uuid} not found`);
		}
	}
	async saveMessage(request: Request): Promise<Response> {
		const data = await request.text();
		return new Response(`[Durable Object] message: ${data}`, {
			status: 501,
		});
	}
	async processMessage(request: Request): Promise<Response> {
		const data = await request.text();
		const webSockets = this.ctx.getWebSockets();
		for (const ws of webSockets) {
			// Send the message to all connected WebSockets
			ws.send(
				`[Durable Object] message: ${data}, connections: ${webSockets.length}`
			);
		}
		return new Response(
			`[Durable Object] message: ${data}, connections: ${
				this.ctx.getWebSockets().length
			}`,
			{
				status: 200,
				headers: { "Content-Type": "text/plain" },
			}
		);
	}
	async fetch(request: Request): Promise<Response> {
		this._topic = extractTopicFromPath(request.url);
		return await this.initializeWebSocket(request);
	}
	async initializeWebSocket(request: Request): Promise<Response> {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		const id = this.generateNewId();
		this.ctx.acceptWebSocket(server, [id]);
		await this.webSocketConnected(server, request);
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}
	async webSocketConnected(ws: WebSocket, request: Request) {
		console.log(
			`[WebSocket] Connected: ${ws.url}, connections: ${
				this.ctx.getWebSockets().length
			}`
		);
		const headers = mapHeaders(request.headers);
		const id = this.getIdFromClient(ws);
		this.onNewClient(id, { headers: headers });
		const info = this.getInfoFromId(id);
		await this.mq.onNewClient(ClientInstance.from(id, info.headers), request);
	}
	async webSocketMessage(ws: WebSocket, data: ArrayBuffer | string) {
		console.log(
			`[WebSocket] Message: ${data}, connections: ${
				this.ctx.getWebSockets().length
			} ${this.clients.length}`
		);
		const id = this.getIdFromClient(ws);
		const info = this.getInfoFromId(id);
		await this.mq.onReceiveMessage(ClientInstance.from(id, info.headers), data);
	}
	async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean
	) {
		console.log(`[WebSocket] Closed: ${code} ${reason} ${wasClean}`);
		try {
			const id = this.getIdFromClient(ws);
			try {
				const info = this.getInfoFromId(id);
				await this.mq.onClose(
					ClientInstance.from(id, info.headers),
					code,
					reason
				);
			} finally {
				this.onRemoveClient(id);
			}
		} catch (error) {
			console.error("[WebSocket] Error on close", error);
		}
		if (code === 1005 || code === 1006) {
			ws.close(1000, `Unknown close code ${code} ${reason}`);
		}
		ws.close(code, reason);
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		console.error("[WebSocket] Error:", error);
		try {
			const id = this.getIdFromClient(ws);
			const info = this.getInfoFromId(id);
			await this.mq.onError(ClientInstance.from(id, info.headers), error);
		} catch (clientError) {
			console.error("[WebSocket] Error handling client error:", clientError);
		}
		ws.close(1011, "Internal server error");
	}
	async broadcast(data: ArrayBuffer | string) {
		return (
			await Promise.all(
				Object.keys(this.clients).map((uuid) => this.sendToClient(uuid, data))
			)
		).length;
	}
	async broadcastExcept(exceptUuid: string, data: ArrayBuffer | string) {
		return (
			await Promise.all(
				Object.keys(this.clients)
					.filter((uuid) => uuid !== exceptUuid)
					.map((uuid) => this.sendToClient(uuid, data))
			)
		).length;
	}
}
export default WebSocketHibernationServer;
