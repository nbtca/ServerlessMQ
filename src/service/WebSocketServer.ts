import { DurableObject } from "cloudflare:workers";
import MessageQueue, { ClientInstance } from "./messagequeue";
import type { Client } from "./messagequeue";
export class WebSocketHibernationServer extends DurableObject<Env> {
	private _topic: string;
	public get topic() {
		return this._topic;
	}
	public get mq() {
		return new MessageQueue(this.topic, this);
	}
	public get clients() {
		return this.clientsList;
	}
	private clientsList: Map<WebSocket, Client> = new Map();
	foreachClient(callback: (client: ClientInstance) => void) {
		for (const [ws, client] of this.clientsList.entries()) {
			callback(new ClientInstance(ws, client.headers));
		}
	}
	async foreachClientAsync(
		callback: (client: ClientInstance) => Promise<void>,
	) {
		for (const [ws, client] of this.clientsList.entries()) {
			await callback(new ClientInstance(ws, client.headers));
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
		this.ctx.acceptWebSocket(server);
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
		const headers: Record<string, string> = {};
		for (const [key, value] of request.headers) {
			switch (key) {
				case "sec-websocket-extensions":
				case "sec-websocket-key":
				case "sec-websocket-version":
				case "upgrade":
					continue;
				default:
					headers[key] = value;
			}
		}
		this.clientsList.set(ws, { headers: headers });
		const info = this.clientsList.get(ws);
		this.mq.onNewClient(new ClientInstance(ws, info.headers), request);
	}
	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		console.log(
			`[WebSocket] Message: ${message}, connections: ${
				this.ctx.getWebSockets().length
			} ${ws.readyState}`,
		);
		const info = this.clientsList.get(ws);
		if (typeof message === "string") {
			this.mq.onReceiveMessage(
				new ClientInstance(ws, info.headers),
				JSON.parse(message),
			);
		}
	}
	async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean,
	) {
		console.log(`[WebSocket] Closed: ${code} ${reason} ${wasClean}`);
		const info = this.clientsList.get(ws);
		this.clientsList.delete(ws);
		this.mq.onClose(new ClientInstance(ws, info.headers), code, reason);
		if (code === 1005 || code === 1006) {
			ws.close(1000, `Unknown close code ${code} ${reason}`);
		}
		ws.close(code, reason);
	}
}
export default WebSocketHibernationServer;
