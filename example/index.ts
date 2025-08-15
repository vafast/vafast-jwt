import { Server, json } from 'tirne'
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
		handler: async (req: Request, context: any) => {
			// Apply JWT middleware
			jwtMiddleware(req, context)

			const url = new URL(req.url)
			const name = url.pathname.split('/').pop()

			// Create cookie
			const token = await context.jwt2.sign({ name })

			return new Response(`Sign in as ${name}`, {
				headers: {
					'Set-Cookie': `auth=${token}; HttpOnly; Max-Age=${
						7 * 86400
					}; Path=/`
				}
			})
		}
	},
	{
		method: 'GET',
		path: '/profile',
		handler: async (req: Request, context: any) => {
			// Apply JWT middleware
			jwtMiddleware(req, context)

			const cookies = req.headers.get('cookie')
			const authCookie = cookies
				?.split(';')
				.find((c) => c.trim().startsWith('auth='))
			const token = authCookie?.split('=')[1]

			const profile = await context.jwt2.verify(token)

			if (!profile) {
				return new Response('Unauthorized', { status: 401 })
			}

			return json({ message: `Hello ${profile.name}` })
		}
	}
]

const server = new Server(routes)

export default {
	fetch: (req: Request) => server.fetch(req)
}
