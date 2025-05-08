# Serverless MQ

> A serverless message queue for Cloudflare Workers
> Based on [Durable Objects](https://developers.cloudflare.com/durable-objects/api/).

---

## 开发工具

<https://biomejs.dev/>

- 格式化（暂存区）代码

```sh
npm run format
```

- （暂存区）代码检查

```sh
npm run lint
```

> 全局格式化和 lint（如有必要）
>
> ```sh
> npx @biomejs/biome format --write ./src
> npx @biomejs/biome lint ./src --fix
> ```

---

## Cloudflare Workers OpenAPI 3.1

This is a Cloudflare Worker with OpenAPI 3.1 using [chanfana](https://github.com/cloudflare/chanfana) and [Hono](https://github.com/honojs/hono).

This is an example project made to be used as a quick start into building OpenAPI compliant Workers that generates the
`openapi.json` schema automatically from code and validates the incoming request to the defined parameters or request body.

## Get started

1. Sign up for [Cloudflare Workers](https://workers.dev). The free tier is more than enough for most use cases.
2. Clone this project and install dependencies with `npm install`
3. Run `wrangler login` to login to your Cloudflare account in wrangler
4. Run `wrangler deploy` to publish the API to Cloudflare Workers

## Project structure

1. Your main router is defined in `src/index.ts`.
2. Each endpoint has its own file in `src/endpoints/`.
3. For more information read the [chanfana documentation](https://chanfana.pages.dev/) and [Hono documentation](https://hono.dev/docs).

## Development

1. Run `wrangler dev` to start a local instance of the API.
2. Open `http://localhost:8787/` in your browser to see the Swagger interface where you can try the endpoints.
3. Changes made in the `src/` folder will automatically trigger the server to reload, you only need to refresh the Swagger interface.

// After adding bindings to `wrangler.jsonc`, regenerate this interface via `npm run cf-typegen`
