import { DurableObject } from "cloudflare:workers";
import MessageQueue from "./messagequeue";
export class WebSocketHibernationServer extends DurableObject<Env> {
  public get topic() {
    return this.ctx.id.name;
  }
  public get mq() {
    return new MessageQueue(this.topic, this);
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
    console.log(
      `[WebSocket] Connected: ${ws.url}, connections: ${
        this.ctx.getWebSockets().length
      }`
    );
    this.mq.onNewClient(ws, request);
  }
  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    console.log(
      `[WebSocket] Message: ${message}, connections: ${
        this.ctx.getWebSockets().length
      } ${ws.readyState}`
    );
    this.mq.onReceiveMessage(ws, message);
  }
  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    console.log(`[WebSocket] Closed: ${code} ${reason} ${wasClean}`);
    this.mq.onClose(ws, code, reason);
    if (code === 1005 || code === 1006) {
      ws.close(1000, `Unknown close code ${code} ${reason}`);
    }
    ws.close(code, reason);
  }
}
export default WebSocketHibernationServer;
