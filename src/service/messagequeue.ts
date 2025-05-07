import { ActiveBroadcastPacket } from "../types";
import type WebSocketHibernationServer from "./websocketserver";

export default class MessageQueue {
  constructor(
    private readonly topic: string,
    public server:
      | DurableObjectStub<WebSocketHibernationServer>
      | WebSocketHibernationServer
  ) {}

  onNewClient(client: WebSocket, request: Request) {
    // Handle new client connection
    console.log("New client connected", this.topic, request.url);
    // Send a welcome message to the client
    client.send(JSON.stringify({ topic: this.topic, message: "Welcome!" }));
  }
  onReceiveMessage(client: WebSocket, data: unknown) {
    // Handle incoming message
    console.log("Received message", this.topic, data);
    // Send a response back to the client
    client.send(JSON.stringify({ topic: this.topic, data }));
  }
  onClose(client: WebSocket, code: number, reason: string) {
    // Handle client close
    console.log("Client closed", this.topic, code, reason);
  }
  onWebhookPost(data: unknown) {
    // Handle webhook post
    console.log("Webhook", this.topic, data);
  }
}
