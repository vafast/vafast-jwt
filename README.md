# @vafast/jwt

Plugin for [Vafast](https://github.com/vafastjs/vafast) for using JWT Authentication.

## Installation

```bash
npm install @vafast/jwt
# or
npm install @vafast/jwt
```

## Example

See [`example/index.ts`](./example/index.ts) for the current v0.8 API:

```typescript
import { Server, defineRoute, defineRoutes, json } from 'vafast'
import { Type as t } from '@sinclair/typebox'
import { jwt } from '@vafast/jwt'

const jwtMiddleware = jwt({
  name: 'jwt',
  secret: 'MY_SECRET',
  sub: 'auth',
  iss: 'example.com',
  exp: '7d',
  schema: t.Object({ name: t.String() }),
})

type JwtRequest = Request & {
  jwt: {
    sign: (data: { name: string }) => Promise<string>
    verify: (token?: string) => Promise<{ name?: string } | false>
  }
}

const routes = defineRoutes([
  defineRoute({
    method: 'GET',
    path: '/sign/:name',
    middleware: [jwtMiddleware],
    handler: async ({ req, params }) => {
      const token = await (req as JwtRequest).jwt.sign({ name: params.name })
      return json({ message: `Sign in as ${params.name}` }, 200, {
        'Set-Cookie': `auth=${token}; HttpOnly; Path=/`,
      })
    },
  }),
  defineRoute({
    method: 'GET',
    path: '/profile',
    middleware: [jwtMiddleware],
    handler: async ({ req }) => {
      const token = req.headers.get('cookie')?.match(/auth=([^;]+)/)?.[1]
      const profile = await (req as JwtRequest).jwt.verify(token)
      if (!profile) return json({ error: 'Unauthorized' }, 401)
      return json({ message: `Hello ${profile.name}` })
    },
  }),
])

const server = new Server(routes)
export default { fetch: (req: Request) => server.fetch(req) }
```

## Config

This package extends [jose](https://github.com/panva/jose), most config is inherited from Jose.

Below are configurable properties for using JWT plugin

### name

Name to decorate method as:

For example, `jwt` will decorate Context with `Context.jwt`

### secret

JWT secret key

### schema

Type strict validation for JWT payload

## Jose's config

Below is the config inherits from [jose](https://github.com/panva/jose)

### alg

@default 'HS256'

Algorithm to sign JWT with

### crit

Critical Header Parameter.

### iss

JWT Issuer

@see [RFC7519#section-4.1.1](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.1)

### sub

JWT Subject

@see [RFC7519#section-4.1.2](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.2)

### aud

JWT Audience

@see [RFC7519#section-4.1.3](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.3)

### jti

JWT ID

@see [RFC7519#section-4.1.7](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.7)

### nbf

JWT Not Before

@see [RFC7519#section-4.1.5](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.5)

### exp

JWT Expiration Time

@see [RFC7519#section-4.1.4](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.4)

### iat

JWT Issued At

@see [RFC7519#section-4.1.6](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.6)
