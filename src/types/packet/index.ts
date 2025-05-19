export interface PacketSourceInfo {
	display_name: string;
	name: string;
	version: string;
}
export interface Packet<T extends {} = unknown> {
	type: string;
	data: T;
	source: PacketSourceInfo;
}
export const defaultSource: PacketSourceInfo = {
	display_name: "ServerlessMQ",
	name: "ServerlessMQ",
	version: "0.0.1",
};

export * from "./activebroadcast";
