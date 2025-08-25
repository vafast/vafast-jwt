import { Server, createRouteHandler } from 'vafast'
import { Type as t } from '@sinclair/typebox'
import { jwt } from '../src'

const jwtMiddleware = jwt({
	name: 'jwt2',
	secret: 'aawdaowdoj',
	sub: 'auth',
	iss: 'saltyaom.com',
	exp: '7d',
	schema: t.Object({
		name: t.String()
	})
})

const routes = [
	{
		method: 'GET',
		path: '/sign/:name',
		handler: createRouteHandler(async ({ req, params }: { req: Request, params: Record<string, string> }) => {
			// Apply JWT middleware
			jwtMiddleware(req, () => Promise.resolve(new Response()))

			const name = params.name

			// Create cookie
			const token = await (req as any).jwt2.sign({ name })

			return {
				data: `Sign in as ${name}`,
				headers: {
					'Set-Cookie': `auth=${token}; HttpOnly; Max-Age=${
						7 * 86400
					}; Path=/`
				}
			}
		})
	},
	{
		method: 'GET',
		path: '/profile',
		handler: createRouteHandler(async ({ req }: { req: Request }) => {
			// Apply JWT middleware
			jwtMiddleware(req, () => Promise.resolve(new Response()))

			const cookies = req.headers.get('cookie')
			const authCookie = cookies
				?.split(';')
				.find((c) => c.trim().startsWith('auth='))
			const token = authCookie?.split('=')[1]

			const profile = await (req as any).jwt2.verify(token)

			if (!profile) {
				return {
					status: 401,
					data: 'Unauthorized'
				}
			}

			return { message: `Hello ${profile.name}` }
		})
	}
]

const server = new Server(routes)

export default {
	fetch: (req: Request) => server.fetch(req)
}
