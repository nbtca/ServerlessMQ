# Serverless MQ

> A serverless message queue for Cloudflare Workers
> Based on [Durable Objects](https://developers.cloudflare.com/durable-objects/api/).

## 项目简介

这是一个基于 [Durable Objects](https://developers.cloudflare.com/durable-objects/api/) 的无服务器消息队列，旨在基于 Cloudflare Workers 提供简单的消息处理能力。

---

## 接入流程

### 1. 部署服务

```bash
# 开发环境
pnpm dev

# 部署到生产环境  
pnpm deploy
```

### 2. 配置鉴权信息

在 `wrangler.jsonc` 中配置全局密钥：

```jsonc
{
  "vars": {
    "GLOBAL_SECRET": "your-secret-key",
    "GLOBAL_TOKEN": "your-auth-token"
  }
}
```

也可以为特定主题配置独立的密钥：

- `TOKEN_<TOPIC>`: 特定主题的Token
- `SECRET_<TOPIC>`: 特定主题的Secret

### 3. 鉴权方式

系统支持两种鉴权方式（二选一）：

#### 方式一：Bearer Token 鉴权

- **Header**: `Authorization: Bearer <token>`
- **查询参数**: `?token=<token>`
- **其他Header**: `X-Auth-Token: <token>`

#### 方式二：HMAC-SHA256 签名鉴权

- **Header**: `X-Hub-Signature-256` 或任何以 `-Signature-256` 结尾的Header
- **算法**: 使用配置的Secret作为HMAC密钥，对请求body进行SHA256签名
- **格式**: `sha256=<hex_signature>`

### 4. API端点

#### WebSocket连接

```text
GET /<topic>
升级协议: WebSocket
鉴权: Token方式（GET请求无body，不支持签名鉴权）
```

#### Webhook推送

```text
POST /<topic>
Content-Type: application/json
鉴权: Token或签名方式
Body: 任意JSON数据
```

### 5. 使用示例

#### 客户端A（推送方）

```javascript
// 使用Token鉴权
fetch('https://your-domain.com/service_1', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Hello World',
    timestamp: Date.now()
  })
});

// 或使用签名鉴权
const signature = await generateHMACSignature(secret, jsonBody);
fetch('https://your-domain.com/service_1', {
  method: 'POST',
  headers: {
    'X-Hub-Signature-256': `sha256=${signature}`,
    'Content-Type': 'application/json'
  },
  body: jsonBody
});
```

#### 客户端B（订阅方）

```javascript
// WebSocket连接
const ws = new WebSocket('wss://your-domain.com/service_1?token=your-token');

ws.onmessage = (event) => {
  const packet = JSON.parse(event.data);
  
  // 处理不同类型的消息
  switch(packet.type) {
    case 'webhook':
      // 处理Webhook消息
      console.log('收到Webhook:', packet.data.body);
      break;
    case 'activebroadcast':
      // 处理客户端状态变化
      console.log('当前连接的客户端:', packet.data.clients);
      break;
    default:
      // 处理其他客户端发送的消息
      console.log('收到消息:', packet);
  }
};
```

### 6. 消息包结构

#### Webhook消息包

```typescript
{
  type: 'webhook',
  data: {
    body: any,        // 原始请求体
    headers: object,  // 请求头
    method: string,   // HTTP方法
    topic: string,    // 主题名称
    url: string       // 请求URL
  }
}
```

#### 客户端状态广播包

```typescript
{
  type: 'activebroadcast',
  data: {
    clients: [{
      address: string,  // 客户端IP
      headers: object   // 连接时的Headers
    }]
  }
}
```

### 7. 特性

- **实时通信**: 基于WebSocket的实时消息推送
- **多种鉴权**: 支持Token和HMAC签名两种安全鉴权方式
- **主题隔离**: 不同主题间完全隔离，支持独立配置
- **客户端状态**: 自动广播客户端连接/断开状态
- **CORS支持**: 内置跨域支持
- **错误处理**: 完善的错误处理和状态码返回

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
