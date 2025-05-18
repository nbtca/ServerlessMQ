import { DurableObject } from "cloudflare:workers";
import MessageQueue, { ClientInstance } from "./messagequeue";
import type { Client as ClientInfo, HeadersType } from "./messagequeue";
function mapHeaders(originalHeaders: Headers) {
	const headers: HeadersType = {};
	for (const [key, value] of originalHeaders) {
		switch (key) {
			case "sec-websocket-extensions":
			case "sec-websocket-key":
			case "sec-websocket-version":
			case "upgrade":
			case "connection":
				continue;
			default:
				headers[key] = headers[key] || [];
				headers[key].push(value);
		}
	}
	return headers;
}
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
	private clientsList: Map<string, ClientInfo> = new Map();
	getInfoFromId(id: string): ClientInfo | undefined {
		return this.clientsList.get(id);
	}
	private readonly idPrefix: string = "websocket_";
	generateNewId() {
		return `${this.idPrefix}${crypto.randomUUID()}`;
	}
	getWebsocketClient(id: string): WebSocket | undefined {
		for (const ws of this.ctx.getWebSockets(id)) {
			return ws;
		}
	}
	getIdFromClient(client: WebSocket): string {
		for (const tag of this.ctx.getTags(client)) {
			if (tag.startsWith(this.idPrefix)) {
				return tag;
			}
		}
		throw new Error("Client not found: missing websocket tag");
	}
	foreachClient(callback: (client: ClientInstance) => void) {
		for (const [uuid, clientInfo] of this.clientsList.entries()) {
			callback(
				new ClientInstance(
					uuid,
					this.getWebsocketClient(uuid),
					clientInfo.headers,
				),
			);
		}
	}
	async foreachClientAsync(
		callback: (client: ClientInstance) => Promise<void>,
	) {
		for (const [uuid, clientInfo] of this.clientsList.entries()) {
			await callback(
				new ClientInstance(
					uuid,
					this.getWebsocketClient(uuid),
					clientInfo.headers,
				),
			);
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
		this._topic = request.url.split("/").pop() || "";
		this._topic = this._topic.split("?")[0];
		return this.initializeWebSocket(request);
	}
	async initializeWebSocket(request: Request): Promise<Response> {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		const id = this.generateNewId();
		this.ctx.acceptWebSocket(server, [id]);
		this.webSocketConnected(server, request);
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
		this.clientsList.set(id, { headers: headers });
		const info = this.getInfoFromId(id);
		await this.mq.onNewClient(
			new ClientInstance(id, ws, info.headers),
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
			new ClientInstance(id, ws, info.headers),
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
		this.clientsList.delete(id);
		await this.mq.onClose(
			new ClientInstance(id, ws, info.headers),
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
