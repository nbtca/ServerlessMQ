import type { HeadersType } from "../utils/req";

export interface Client {
	headers: HeadersType;
}
export class ClientInstance implements Client {
	public static from(uuid: string, headers: HeadersType): ClientInstance {
		return new ClientInstance(uuid, headers);
	}
	constructor(
		public uuid: string,
		public headers: HeadersType
	) {}
	equals(other: ClientInstance): boolean {
		return this.uuid === other.uuid;
	}
}
