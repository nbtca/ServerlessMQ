export interface PacketSourceInfo {
	display_name: string;
	name: string;
	version: string;
}
export interface ActiveBroadcastPacketDataClient {
	address: string;
	headers: Record<string, string[]>;
}
export interface ActiveBroadcastPacketData {
	clients: ActiveBroadcastPacketDataClient[];
}
export interface Packet {
	type: string;
	source: PacketSourceInfo;
	data: ActiveBroadcastPacketData;
}
export class ActiveBroadcastPacket implements Packet {
	type = "active_clients_change";
	source: PacketSourceInfo = {
		display_name: "ServerlessMQ",
		name: "ServerlessMQ",
		version: "0.0.1",
	};
	constructor(public data: ActiveBroadcastPacketData) {}
}
