export type HeadersType = Record<string, string[]>;

export function mapHeaders(originalHeaders: Headers) {
	const headers: HeadersType = {};
	for (const [key, value] of originalHeaders.entries()) {
		switch (key) {
			case "sec-websocket-extensions":
			case "sec-websocket-key":
			case "sec-websocket-version":
			case "upgrade":
			case "connection":
			case "authorization":
				continue;
			default:
				if (!key.endsWith("-signature-256")) {
					headers[key] = headers[key] || [];
					headers[key].push(value);
				}
		}
	}
	return headers;
}
