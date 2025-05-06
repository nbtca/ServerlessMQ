import { DurableObject } from "cloudflare:workers";

export class WebSocketHibernationServer extends DurableObject<Env> {
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
			`[Durable Object] message: ${data}, connections: ${this.ctx.getWebSockets().length}`,
			{
				status: 200,
				headers: { "Content-Type": "text/plain" },
			},
		);
	}
	async fetch(request: Request) {
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
		console.log(`[WebSocket] New Client Connected: ${request.url}`);
	}
	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		console.log(
			`[WebSocket] Message: ${message}, connections: ${this.ctx.getWebSockets().length} ${ws.readyState}`,
		);
	}
	async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean,
	) {
		console.log(`[WebSocket] Closed: ${code} ${reason} ${wasClean}`);
		if (code === 1005) {
			code = 1000;
		}
		ws.close(code, reason);
	}
}
export default WebSocketHibernationServer;
