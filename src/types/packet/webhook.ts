import { defaultSource, type Packet } from ".";

export interface WebhookPacketData {
	headers: Record<string, string[]>;
	body: unknown;
	method: string;
	topic: string;
	url: string;
}
export class WebhookPacket implements Packet<WebhookPacketData> {
	type = "webhook";
	data: WebhookPacketData;
	source = { ...defaultSource };
	constructor(data: WebhookPacketData) {
		this.data = data;
	}
}
