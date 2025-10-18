import type { Packet } from "../types";
import type { HeadersType } from "../utils/req";

export interface Client {
	headers: HeadersType;
}
export class ClientInstance implements Client {
	private _send: (data: ArrayBuffer | string) => Promise<void>;
	public static from(
		uuid: string,
		client: WebSocket,
		headers: HeadersType
	): ClientInstance {
		return new ClientInstance(uuid, async (data) => client.send(data), headers);
	}
	constructor(
		public uuid: string,
		sendFunc: (data: ArrayBuffer | string) => Promise<void>,
		public headers: HeadersType
	) {
		this._send = sendFunc;
	}
	async sendRaw(data: ArrayBuffer | string) {
		await this._send(data);
	}
	async sendUnknown(pkt: unknown) {
		await this.sendRaw(JSON.stringify(pkt));
	}
	async sendPacket(pkt: Packet) {
		await this.sendRaw(JSON.stringify(pkt));
	}
	equals(other: ClientInstance): boolean {
		return this.uuid === other.uuid;
	}
}
