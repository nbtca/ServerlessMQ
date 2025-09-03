import type { Context as HonoContext } from "hono";
interface Context<P extends string = string>
	extends HonoContext<
		{
			Bindings: Env;
		},
		P
	> {}
export type { Context };
export * from "./packet";
export * from "./error";
