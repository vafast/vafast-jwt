import { Server, createRouteHandler } from 'vafast'
import { jwt } from '../src/index'

describe('Vafast JWT Plugin', () => {
	it('should sign JWT tokens', async () => {
		const jwtMiddleware = jwt({
			name: 'jwt',
			secret: 'test-secret',
			sub: 'auth',
			iss: 'test.com',
			exp: '1h'
		})

		const app = new Server([
			{
				method: 'GET',
				path: '/sign',
				handler: createRouteHandler(
					async ({ req }: { req: Request }) => {
						// Apply JWT middleware
						jwtMiddleware(req, () =>
							Promise.resolve(new Response())
						)

						const token = await (req as any).jwt.sign({
							name: 'testuser'
						})
						return { token }
					}
				),
				middleware: [jwtMiddleware]
			}
		])

		const res = await app.fetch(new Request('http://localhost/sign'))
		const data = await res.json()

		expect(data.token).toBeDefined()
		expect(typeof data.token).toBe('string')
		expect(data.token.split('.')).toHaveLength(3) // JWT has 3 parts
	})

	it('should verify JWT tokens', async () => {
		const jwtMiddleware = jwt({
			name: 'jwt',
			secret: 'test-secret',
			sub: 'auth',
			iss: 'test.com',
			exp: '1h'
		})

		const app = new Server([
			{
				method: 'GET',
				path: '/verify',
				handler: createRouteHandler(
					async ({ req }: { req: Request }) => {
						// Apply JWT middleware
						jwtMiddleware(req, () =>
							Promise.resolve(new Response())
						)

						// First sign a token
						const token = await (req as any).jwt.sign({
							name: 'testuser',
							id: 123
						})

						// Then verify it
						const payload = await (req as any).jwt.verify(token)

						return { payload }
					}
				),
				middleware: [jwtMiddleware]
			}
		])

		const res = await app.fetch(new Request('http://localhost/verify'))
		const data = await res.json()

		expect(data.payload).toBeDefined()
		expect(data.payload.name).toBe('testuser')
		expect(data.payload.id).toBe(123)
	})

	it('should handle invalid JWT tokens', async () => {
		const jwtMiddleware = jwt({
			name: 'jwt',
			secret: 'test-secret',
			sub: 'auth',
			iss: 'test.com',
			exp: '1h'
		})

		const app = new Server([
			{
				method: 'GET',
				path: '/verify-invalid',
				handler: createRouteHandler(
					async ({ req }: { req: Request }) => {
						// Apply JWT middleware
						jwtMiddleware(req, () =>
							Promise.resolve(new Response())
						)

						// Try to verify an invalid token
						const payload = await (req as any).jwt.verify(
							'invalid.token.here'
						)

						return { payload }
					}
				),
				middleware: [jwtMiddleware]
			}
		])

		const res = await app.fetch(
			new Request('http://localhost/verify-invalid')
		)
		const data = await res.json()

		expect(data.payload).toBe(false)
	})

	it('should work with custom JWT namespace', async () => {
		const jwtMiddleware = jwt({
			name: 'auth',
			secret: 'test-secret',
			sub: 'auth',
			iss: 'test.com',
			exp: '1h'
		})

		const app = new Server([
			{
				method: 'GET',
				path: '/custom-namespace',
				handler: createRouteHandler(
					async ({ req }: { req: Request }) => {
						// Apply JWT middleware
						jwtMiddleware(req, () =>
							Promise.resolve(new Response())
						)

						const token = await (req as any).auth.sign({
							name: 'testuser'
						})
						const payload = await (req as any).auth.verify(token)

						return { token, payload }
					}
				),
				middleware: [jwtMiddleware]
			}
		])

		const res = await app.fetch(
			new Request('http://localhost/custom-namespace')
		)
		const data = await res.json()

		expect(data.token).toBeDefined()
		expect(data.payload).toBeDefined()
		expect(data.payload.name).toBe('testuser')
	})

	it('should handle JWT with custom claims', async () => {
		const jwtMiddleware = jwt({
			name: 'jwt',
			secret: 'test-secret',
			sub: 'auth',
			iss: 'test.com',
			exp: '1h',
			aud: 'test-audience'
		})

		const app = new Server([
			{
				method: 'GET',
				path: '/custom-claims',
				handler: createRouteHandler(
					async ({ req }: { req: Request }) => {
						// Apply JWT middleware
						jwtMiddleware(req, () =>
							Promise.resolve(new Response())
						)

						const token = await (req as any).jwt.sign({
							name: 'testuser',
							role: 'admin',
							permissions: ['read', 'write']
						})

						const payload = await (req as any).jwt.verify(token)

						return { payload }
					}
				),
				middleware: [jwtMiddleware]
			}
		])

		const res = await app.fetch(
			new Request('http://localhost/custom-claims')
		)
		const data = await res.json()

		expect(data.payload).toBeDefined()
		expect(data.payload.name).toBe('testuser')
		expect(data.payload.role).toBe('admin')
		expect(data.payload.permissions).toEqual(['read', 'write'])
		expect(data.payload.aud).toBe('test-audience')
		expect(data.payload.iss).toBe('test.com')
		expect(data.payload.sub).toBe('auth')
	})
})
