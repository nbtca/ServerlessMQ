import MessageQueue from "../service/messagequeue";
import type WebSocketServer from "../service/websocketserver";
import type { Context } from "../types";
// https://github.com/honojs/hono/blob/dfacf89663445b3196219d95311831afb00a6700/src/utils/url.ts#L132
import { getPathNoStrict, splitPath } from "hono/utils/url";
export function getServer(
	c: Context<"/:topic">
): DurableObjectStub<WebSocketServer> {
	const topic = c.req.param("topic");
	const id = c.env.WebSocketServer.idFromName(topic);
	const durableObj = c.env.WebSocketServer.get(id);
	return durableObj;
}
export function getMQ(c: Context<"/:topic">): MessageQueue {
	const topic = c.req.param("topic");
	const server = getServer(c);
	return new MessageQueue(topic, server);
}
export function extractTopicFromPath(url: string): string {
	// Get the topic from path pattern "/:topic"
	const path = getPathNoStrict({ url } as Request);
	const [topic] = splitPath(path);
	return topic || "";
}
