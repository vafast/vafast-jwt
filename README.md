# @vafast/jwt

Vafast 的 JWT **签发 / 校验**中间件，基于 [jose](https://github.com/panva/jose)。

把 `{ sign, verify }` 挂到 `Request`（默认 `req.jwt`）。**不会**自动鉴权或注入用户，需在业务中自行调用。

## 安装

```bash
npm install @vafast/jwt
```

## 快速开始

```typescript
import { Server, defineRoute, defineRoutes, json, serve } from 'vafast'
import { jwt } from '@vafast/jwt'

const jwtMiddleware = jwt({
  secret: process.env.JWT_SECRET!,
  iss: 'my-app',
  exp: '7d',
})

type JwtRequest = Request & {
  jwt: {
    sign: (data: { userId: string }) => Promise<string>
    verify: (token?: string) => Promise<{ userId?: string } | false>
  }
}

const routes = defineRoutes([
  defineRoute({
    method: 'POST',
    path: '/login',
    middleware: [jwtMiddleware],
    handler: async ({ req }) => {
      const token = await (req as JwtRequest).jwt.sign({ userId: 'u_1' })
      return json({ token })
    },
  }),
  defineRoute({
    method: 'GET',
    path: '/me',
    middleware: [jwtMiddleware],
    handler: async ({ req }) => {
      const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      const payload = await (req as JwtRequest).jwt.verify(token)
      if (!payload) return json({ error: 'Unauthorized' }, 401)
      return json({ userId: payload.userId })
    },
  }),
])

const server = new Server(routes)
serve({ fetch: server.fetch, port: 3000 })
```

## 概念速览

| 名词 | 白话 |
|------|------|
| JWT | 三段式令牌：`header.payload.signature`。Payload 可读但不可随意篡改 |
| Claim | Payload 里的字段；有标准声明（`exp` 等）和业务字段（`userId` 等） |
| Header | 描述算法 / 密钥提示等（`alg`、`typ`、`kid`…） |

本包负责签发与校验；何时 401、从 Header 还是 Cookie 取 token，由业务决定。

## 选项（完整）

### 业务选项

| 选项 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `secret` | `string \| Uint8Array \| JWK` | — | **必填**。空值抛 `Secret can't be empty`；字符串会 `TextEncoder.encode` |
| `name` | `string` | `'jwt'` | 挂载字段名，如 `req.jwt` / `req.accessToken` |
| `schema` | TypeBox `TSchema`（请用 `import { Type } from 'vafast'` 创建） | — | `sign` 失败抛错；`verify` 失败返回 `false`。勿另装冲突版本的 `@sinclair/typebox` |

### 标准 Claims（可在配置设默认，也可在 `sign(data)` 覆盖）

| 选项 | 含义 | 说明 |
|------|------|------|
| `iss` | Issuer 签发者 | 谁发的 token，如 `'my-app'` |
| `sub` | Subject 主体 | token 关于谁，常放用户 ID |
| `aud` | Audience 受众 | 签发给谁用；可为 `string[]` |
| `jti` | JWT ID | 令牌唯一编号，便于吊销 / 审计 |
| `nbf` | Not Before | 生效起点；未到则校验失败 |
| `exp` | Expiration | 过期时间；建议始终配置，如 `'15m'` / `'7d'` |
| `iat` | Issued At | 默认写入当前签发时间；设相关条件为 `false` 可影响是否写入 |

时间字段（`exp` / `nbf`）常用相对时长：`'60s'`、`'15m'`、`'1h'`、`'7d'`。

### JOSE Header

| 选项 | 默认 | 说明 |
|------|------|------|
| `alg` | `'HS256'` | 签名算法；默认对称密钥，改算法时密钥类型需匹配 |
| `typ` | `'JWT'` | 令牌类型，一般保持默认 |
| `kid` | — | 密钥 ID，多密钥轮换时使用 |
| `jwk` | — | 内嵌 JWK |
| `jku` | — | JWK Set URL |
| `x5c` / `x5t` / `x5u` | — | X.509 证书相关 |
| `cty` | — | 内容类型（嵌套 JWT 等） |
| `crit` | — | 关键扩展头列表 |
| `b64` | — | RFC 7797；普通登录场景勿改 |

## 方法

- **`sign(data)`** → `Promise<string>`：可选 schema 校验 → 合并 claims/header → 签名
- **`verify(jwt?)`** → `Promise<payload | false>`：失败一律 `false`（不抛错）

## 文档

完整概念解释、场景示例与注意事项见站点文档：[JWT 中间件](https://vafast.huyooo.com/middleware/jwt.html)（仓库内 `vafast-doc/docs/middleware/jwt.md`）。

## License

见仓库根目录。
