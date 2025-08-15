import { Server, json } from 'tirne'
import { Type as t } from '@sinclair/typebox'
import { jwt } from '../src'
import { SignJWT } from 'jose'

import { describe, expect, it } from 'bun:test'

const post = (path: string, body = {}) =>
	new Request(`http://localhost${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	})

const TEST_SECRET = 'A'

describe('JWT Plugin', () => {
	const jwtMiddleware = jwt({
		name: 'jwt',
		secret: TEST_SECRET
		//exp: '1h' // default expiration,
		//iat: true - default iat included
	})

	const routes = [
		{
			method: 'POST',
			path: '/sign-token',
			handler: async (req: Request, context: any) => {
				jwtMiddleware(req, context)
				
				const body = await req.json()
				const token = await context.jwt.sign({
					name: body.name,
					exp: '30m'
				})
				
				return new Response(token)
			}
		},
		{
			method: 'POST',
			path: '/verify-token',
			handler: async (req: Request, context: any) => {
				jwtMiddleware(req, context)
				
				const body = await req.json()
				const verifiedPayload = await context.jwt.verify(body.token)
				
				if (!verifiedPayload) {
					return json({
						success: false,
						data: null,
						message: 'Verification failed'
					})
				}
				return json({ success: true, data: verifiedPayload })
			}
		},
		{
			method: 'POST',
			path: '/verify-token-with-exp-and-iat',
			handler: async (req: Request, context: any) => {
				jwtMiddleware(req, context)
				
				const body = await req.json()
				const verifiedPayload = await context.jwt.verify(body.token)
				
				if (!verifiedPayload) {
					return json({
						success: false,
						data: null,
						message: 'Verification failed'
					})
				}

				if (!verifiedPayload.exp) {
					return json({
						success: false,
						data: null,
						message: 'exp was not setted on jwt'
					})
				}
				if (!verifiedPayload.iat) {
					return json({
						success: false,
						data: null,
						message: 'iat was not setted on jwt'
					})
				}
				return json({ success: true, data: verifiedPayload })
			}
		}
	]

	const server = new Server(routes)

	it('should sign JWT and then verify', async () => {
		const payloadToSign = { name: 'Shirokami' }

		const signRequest = post('/sign-token', payloadToSign)
		const signResponse = await server.fetch(signRequest)
		const token = await signResponse.text()

		expect(token.split('.').length).toBe(3)

		const verifyRequest = post('/verify-token', { token })
		const verifyResponse = await server.fetch(verifyRequest)
		const verifiedResult = (await verifyResponse.json()) as {
			success: boolean
			data: { name: string; exp: number } | null
		}

		expect(verifiedResult.success).toBe(true)
		expect(verifiedResult.data?.name).toBe(payloadToSign.name)
		expect(verifiedResult.data?.exp).toBeDefined()
	})

	it('should return verification failed for an invalid token', async () => {
		const verifyRequest = post('/verify-token', {
			token: 'invalid'
		})
		const verifyResponse = await server.fetch(verifyRequest)
		const verifiedResult = await verifyResponse.json()

		expect(verifiedResult.success).toBe(false)
		expect(verifiedResult.message).toBe('Verification failed')
	})

	it('should return verification failed for an expired token', async () => {
		const key = new TextEncoder().encode(TEST_SECRET)
		const expiredToken = await new SignJWT({ name: 'Expired User' })
			.setProtectedHeader({ alg: 'HS256' })
			.setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
			.sign(key)

		const verifyRequest = post('/verify-token', { token: expiredToken })
		const verifyResponse = await server.fetch(verifyRequest)
		const verifiedResult = await verifyResponse.json()

		expect(verifiedResult.success).toBe(false)
		expect(verifiedResult.message).toBe('Verification failed')
	})

	it('should sign JWT with default values (exp and iat) and then verify', async () => {
		const payloadToSign = { name: 'John Doe' }

		const signRequest = post('/sign-token', payloadToSign)
		const signResponse = await server.fetch(signRequest)
		const token = await signResponse.text()

		expect(token.split('.').length).toBe(3)

		const verifyRequest = post('/verify-token-with-exp-and-iat', { token })
		const verifyResponse = await server.fetch(verifyRequest)

		const verifiedResult = (await verifyResponse.json()) as {
			success: boolean
			data: { name: string; exp: number; iat: number } | null
		}

		expect(verifiedResult.success).toBe(true)
		expect(verifiedResult.data?.name).toBe(payloadToSign.name)
		expect(verifiedResult.data?.exp).toBeDefined()
		expect(verifiedResult.data?.iat).toBeDefined()
	})
})
