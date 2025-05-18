import MessageQueue from "../service/messagequeue";
import type WebSocketServer from "../service/websocketserver";
import type { Context } from "../types";
export function getServer(
	c: Context<"/:topic">,
): DurableObjectStub<WebSocketServer> {
	const topic = c.req.param("topic");
	const id = c.env.WebSocketServer.idFromName(topic);
	const durableObj = c.env.WebSocketServer.get(id);
	// durableObj.setTopic(topic);
	return durableObj;
}
export function getMQ(c: Context<"/:topic">): MessageQueue {
	const topic = c.req.param("topic");
	const server = getServer(c);
	return new MessageQueue(topic, server);
}
