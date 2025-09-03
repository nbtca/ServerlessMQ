import { defaultSource, type Packet } from ".";

export interface ActiveBroadcastPacketDataClient {
	address: string;
	headers: Record<string, string[]>;
}
export interface ActiveBroadcastPacketData {
	clients: ActiveBroadcastPacketDataClient[];
}
export class ActiveBroadcastPacket
	implements Packet<ActiveBroadcastPacketData>
{
	type = "active_clients_change";
	data: ActiveBroadcastPacketData;
	source = { ...defaultSource };
	constructor(data: ActiveBroadcastPacketData) {
		this.data = data;
	}
}
