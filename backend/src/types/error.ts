interface HTTPResponseError extends Error {
	getResponse: () => Response;
}
class HttpError extends Error implements HTTPResponseError {
	constructor(
		message: string,
		public statusCode = 500,
		public code?: string
	) {
		super(message);
		this.name = "HttpError";
	}
	getResponse() {
		return new Response(this.message, {
			status: this.statusCode,
			headers: {
				"Content-Type": "plain/text",
				"Response-Error": this.code || "Unknown",
			},
		});
	}
	override toString() {
		return `${this.name} (${this.statusCode}): ${this.message}`;
	}
}
export { HttpError };
