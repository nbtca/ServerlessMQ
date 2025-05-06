import WebSocketServer from "../service/WebSocketServer";
import { Context, HttpError } from "../types";
export function getServer(
	c: Context<"/:topic">,
): DurableObjectStub<WebSocketServer> {
	const topic = c.req.param("topic");
	const id = c.env.WebSocketServer.idFromName(topic);
	const durableObj = c.env.WebSocketServer.get(id);
	return durableObj;
}
