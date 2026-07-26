import { Server, defineRoute, defineRoutes, defineMiddleware, err, json, Type } from 'vafast'
import { describe, expect, it } from 'vitest'
import { jwt } from '../src/index'

type JwtApi = {
	sign: (data: Record<string, unknown>) => Promise<string>
	verify: (token?: string) => Promise<Record<string, unknown> | false>
}

function getJwt(req: Request, name = 'jwt'): JwtApi {
	const value = Reflect.get(req, name)
	if (!value || typeof value !== 'object') {
		throw new Error(`JWT methods not found on request.${name}`)
	}
	return value as JwtApi
}

describe('@vafast/jwt', () => {
	it('rejects empty secret', () => {
		expect(() => jwt({ secret: '' })).toThrow("Secret can't be empty")
	})

	it('mounts sign/verify on request via middleware name', async () => {
		const jwtMiddleware = jwt({
			name: 'jwt',
			secret: 'test-secret',
			iss: 'test.com',
			exp: '1h',
		})

		const app = new Server(
			defineRoutes([
				defineRoute({
					method: 'GET',
					path: '/sign',
					middleware: [jwtMiddleware],
					handler: async ({ req }) => {
						const token = await getJwt(req).sign({ name: 'alice' })
						return { token }
					},
				}),
			])
		)

		const res = await app.fetch(new Request('http://localhost/sign'))
		const data = await res.json()

		expect(res.status).toBe(200)
		expect(typeof data.token).toBe('string')
		expect(data.token.split('.')).toHaveLength(3)
	})

	it('signs and verifies payload with default claims', async () => {
		const jwtMiddleware = jwt({
			name: 'jwt',
			secret: 'test-secret',
			sub: 'auth',
			iss: 'test.com',
			aud: 'web',
			exp: '1h',
		})

		const app = new Server(
			defineRoutes([
				defineRoute({
					method: 'GET',
					path: '/roundtrip',
					middleware: [jwtMiddleware],
					handler: async ({ req }) => {
						const api = getJwt(req)
						const token = await api.sign({
							name: 'alice',
							role: 'admin',
						})
						const payload = await api.verify(token)
						return { payload }
					},
				}),
			])
		)

		const res = await app.fetch(new Request('http://localhost/roundtrip'))
		const data = await res.json()

		expect(data.payload.name).toBe('alice')
		expect(data.payload.role).toBe('admin')
		expect(data.payload.iss).toBe('test.com')
		expect(data.payload.sub).toBe('auth')
		expect(data.payload.aud).toBe('web')
		expect(typeof data.payload.iat).toBe('number')
		expect(typeof data.payload.exp).toBe('number')
	})

	it('verify returns false for missing / invalid / wrong-secret tokens', async () => {
		const jwtMiddleware = jwt({
			name: 'jwt',
			secret: 'test-secret',
			exp: '1h',
		})

		const app = new Server(
			defineRoutes([
				defineRoute({
					method: 'GET',
					path: '/check',
					middleware: [jwtMiddleware],
					handler: async ({ req }) => {
						const api = getJwt(req)
						const token = await api.sign({ name: 'alice' })
						const other = jwt({
							name: 'other',
							secret: 'other-secret',
							exp: '1h',
						})
						await other(req, async () => new Response())
						const otherApi = getJwt(req, 'other')

						return {
							missing: await api.verify(),
							invalid: await api.verify('not.a.jwt'),
							wrongSecret: await otherApi.verify(token),
							ok: await api.verify(token),
						}
					},
				}),
			])
		)

		const res = await app.fetch(new Request('http://localhost/check'))
		const data = await res.json()

		expect(data.missing).toBe(false)
		expect(data.invalid).toBe(false)
		expect(data.wrongSecret).toBe(false)
		expect(data.ok.name).toBe('alice')
	})

	it('supports custom name namespace', async () => {
		const jwtMiddleware = jwt({
			name: 'accessToken',
			secret: 'test-secret',
			exp: '15m',
		})

		const app = new Server(
			defineRoutes([
				defineRoute({
					method: 'GET',
					path: '/custom',
					middleware: [jwtMiddleware],
					handler: async ({ req }) => {
						const api = getJwt(req, 'accessToken')
						const token = await api.sign({ userId: 'u_1' })
						const payload = await api.verify(token)
						return { payload }
					},
				}),
			])
		)

		const res = await app.fetch(new Request('http://localhost/custom'))
		const data = await res.json()
		expect(data.payload.userId).toBe('u_1')
	})

	it('schema rejects invalid payload on sign and verify', async () => {
		const Payload = Type.Object({
			userId: Type.String(),
			role: Type.Union([Type.Literal('user'), Type.Literal('admin')]),
		})

		const jwtMiddleware = jwt({
			name: 'jwt',
			secret: 'test-secret',
			exp: '1h',
			schema: Payload,
		})

		const app = new Server(
			defineRoutes([
				defineRoute({
					method: 'GET',
					path: '/schema',
					middleware: [jwtMiddleware],
					handler: async ({ req }) => {
						const api = getJwt(req)

						let signError = ''
						try {
							await api.sign({ userId: 1, role: 'admin' })
						} catch (error) {
							signError = error instanceof Error ? error.message : String(error)
						}

						const validToken = await api.sign({
							userId: 'u_1',
							role: 'admin',
						})

						// 无 schema 的实例签发「缺字段」token，再用带 schema 的实例校验
						const loose = jwt({ name: 'loose', secret: 'test-secret', exp: '1h' })
						await loose(req, async () => new Response())
						const badToken = await getJwt(req, 'loose').sign({ role: 'admin' })

						return {
							signError,
							valid: await api.verify(validToken),
							invalidPayload: await api.verify(badToken),
						}
					},
				}),
			])
		)

		const res = await app.fetch(new Request('http://localhost/schema'))
		const data = await res.json()

		expect(data.signError).toContain('schema')
		expect(data.valid.userId).toBe('u_1')
		expect(data.valid.role).toBe('admin')
		expect(data.invalidPayload).toBe(false)
	})

	it('works with requireUser-style middleware from docs', async () => {
		const jwtMiddleware = jwt({
			name: 'jwt',
			secret: 'doc-secret',
			iss: 'my-app',
			exp: '15m',
		})

		type AuthUser = { id: string; role: unknown }
		const requireUser = defineMiddleware<{ user: AuthUser }>(async (req, next) => {
			const header = req.headers.get('authorization')
			const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
			const payload = await getJwt(req).verify(token)
			if (!payload || typeof payload.userId !== 'string') {
				throw err.unauthorized('请先登录')
			}
			return next({
				user: {
					id: payload.userId,
					role: payload.role,
				},
			})
		})

		const app = new Server(
			defineRoutes([
				defineRoute({
					method: 'POST',
					path: '/auth/login',
					middleware: [jwtMiddleware],
					handler: async ({ req }) => {
						const token = await getJwt(req).sign({
							userId: 'u_1',
							role: 'admin',
						})
						return { token }
					},
				}),
				// 子路由不会自动继承父级 middleware 的上下文类型，鉴权挂在叶子路由上
				defineRoute({
					method: 'GET',
					path: '/api/profile',
					middleware: [jwtMiddleware, requireUser],
					handler: ({ user }) => ({ id: user.id, role: user.role }),
				}),
			])
		)

		const loginRes = await app.fetch(
			new Request('http://localhost/auth/login', { method: 'POST' })
		)
		const { token } = await loginRes.json()

		const unauthorized = await app.fetch(
			new Request('http://localhost/api/profile')
		)
		expect(unauthorized.status).toBe(401)

		const ok = await app.fetch(
			new Request('http://localhost/api/profile', {
				headers: { authorization: `Bearer ${token}` },
			})
		)
		expect(ok.status).toBe(200)
		expect(await ok.json()).toEqual({ id: 'u_1', role: 'admin' })
	})

	it('sets cookie via json headers helper', async () => {
		const jwtMiddleware = jwt({
			name: 'jwt',
			secret: 'cookie-secret',
			exp: '7d',
		})

		const app = new Server(
			defineRoutes([
				defineRoute({
					method: 'POST',
					path: '/login',
					middleware: [jwtMiddleware],
					handler: async ({ req }) => {
						const token = await getJwt(req).sign({ userId: 'u_1' })
						return json(
							{ ok: true },
							200,
							{
								'Set-Cookie': `auth=${token}; HttpOnly; Path=/`,
							}
						)
					},
				}),
			])
		)

		const res = await app.fetch(
			new Request('http://localhost/login', { method: 'POST' })
		)
		expect(res.status).toBe(200)
		expect(res.headers.get('set-cookie')).toMatch(/^auth=eyJ/)
		expect(await res.json()).toEqual({ ok: true })
	})
})
