import { DurableObject } from "cloudflare:workers";
import MessageQueue, { ClientInstance } from "./messagequeue";
import type { Client as ClientInfo } from "./messagequeue";
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
	get clients() {
		return this.clientsList;
	}
	private clientsList: Record<string, ClientInfo> = {};
	getInfoFromId(id: string): ClientInfo {
		const info = this.clientsList[id];
		if (info) {
			return info;
		}
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
		throw new Error(`[getWebsocketClient] WebSocket ${id} not found`);
	}
	getIdFromClient(client: WebSocket): string {
		for (const tag of this.ctx.getTags(client)) {
			if (tag.startsWith(this.idPrefix)) {
				return tag;
			}
		}
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
				`[Durable Object] message: ${data}, connections: ${webSockets.length}`,
			);
		}
		return new Response(
			`[Durable Object] message: ${data}, connections: ${
				this.ctx.getWebSockets().length
			}`,
			{
				status: 200,
				headers: { "Content-Type": "text/plain" },
			},
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
			}`,
		);
		const headers = mapHeaders(request.headers);
		const id = this.getIdFromClient(ws);
		this.clientsList[id] = { headers: headers };
		const info = this.getInfoFromId(id);
		await this.mq.onNewClient(
			ClientInstance.from(id, ws, info.headers),
			request,
		);
	}
	async webSocketMessage(ws: WebSocket, data: ArrayBuffer | string) {
		console.log(
			`[WebSocket] Message: ${data}, connections: ${
				this.ctx.getWebSockets().length
			} ${ws.readyState}`,
		);
		const id = this.getIdFromClient(ws);
		const info = this.getInfoFromId(id);
		await this.mq.onReceiveMessage(
			ClientInstance.from(id, ws, info.headers),
			data,
		);
	}
	async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean,
	) {
		console.log(`[WebSocket] Closed: ${code} ${reason} ${wasClean}`);
		const id = this.getIdFromClient(ws);
		const info = this.getInfoFromId(id);
		delete this.clientsList[id];
		await this.mq.onClose(
			ClientInstance.from(id, ws, info.headers),
			code,
			reason,
		);
		if (code === 1005 || code === 1006) {
			ws.close(1000, `Unknown close code ${code} ${reason}`);
		}
		ws.close(code, reason);
	}
}
export default WebSocketHibernationServer;
