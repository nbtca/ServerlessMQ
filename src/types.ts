import { Context as HonoContext } from "hono";
interface HTTPResponseError extends Error {
	getResponse: () => Response;
}
interface Context<P extends string = any>
	extends HonoContext<
		{
			Bindings: Env;
		},
		P
	> {}

class HttpError extends Error implements HTTPResponseError {
	constructor(
		message: string,
		public statusCode: number = 500,
		public code?: string,
	) {
		super(message);
		this.name = "HttpError";
	}
	getResponse() {
		return new Response(this.message, {
			status: this.statusCode,
			headers: { "Content-Type": "plain/text" },
		});
	}
	override toString() {
		return `${this.name} (${this.statusCode}): ${this.message}`;
	}
}
export type { Context };
export { HttpError };
