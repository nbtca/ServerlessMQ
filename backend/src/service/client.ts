import type { Packet } from "../types";
import type { HeadersType } from "../utils/req";

export interface Client {
	headers: HeadersType;
}
export class ClientInstance implements Client {
	private _send: (data: ArrayBuffer | string) => void;
	public static from(
		uuid: string,
		client: WebSocket,
		headers: HeadersType
	): ClientInstance {
		return new ClientInstance(uuid, (data) => client.send(data), headers);
	}
	constructor(
		public uuid: string,
		sendFunc: (data: ArrayBuffer | string) => void,
		public headers: HeadersType
	) {
		this._send = sendFunc;
	}
	sendRaw(data: ArrayBuffer | string) {
		this._send(data);
	}
	sendUnknown(pkt: unknown) {
		this.sendRaw(JSON.stringify(pkt));
	}
	sendPacket(pkt: Packet) {
		this.sendRaw(JSON.stringify(pkt));
	}
	equals(other: ClientInstance): boolean {
		return this.uuid === other.uuid;
	}
}
