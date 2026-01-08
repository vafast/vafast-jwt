# @vafast/jwt

Plugin for [Vafast](https://github.com/vafastjs/vafast) for using JWT Authentication.

## Installation

```bash
npm install @vafast/jwt
# or
npm install @vafast/jwt
```

## Example

```typescript
import { Server, createHandler } from 'vafast';
import { Type as t } from '@sinclair/typebox';
import { jwt } from '@vafast/jwt';

const jwtMiddleware = jwt({
  name: 'jwt',
  // This should be Environment Variable
  secret: 'MY_SECRETS',
});

const routes = [
  {
    method: 'GET',
    path: '/sign/:name',
    handler: createHandler(async (req: Request, context: any) => {
      // Apply JWT middleware
      jwtMiddleware(req, context);
      
      const url = new URL(req.url);
      const name = url.pathname.split('/').pop();
      
      // Create cookie
      const token = await context.jwt.sign({ name });
      
      return new Response(`Sign in as ${name}`, {
        headers: {
          'Set-Cookie': `auth=${token}; HttpOnly; Path=/`
        }
      });
    })
  },
  {
    method: 'GET',
    path: '/profile',
    handler: createHandler(async (req: Request, context: any) => {
      // Apply JWT middleware
      jwtMiddleware(req, context);
      
      const cookies = req.headers.get('cookie');
      const authCookie = cookies?.split(';').find(c => c.trim().startsWith('auth='));
      const token = authCookie?.split('=')[1];
      
      const profile = await context.jwt.verify(token);

      if (!profile) {
        return new Response('Unauthorized', { status: 401 });
      }

      return new Response(JSON.stringify({ message: `Hello ${profile.name}` }), {
        headers: { 'Content-Type': 'application/json' }
      });
    })
  }
];

const server = new Server(routes);

export default {
  fetch: (req: Request) => server.fetch(req)
};
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
