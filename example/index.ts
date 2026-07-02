import { Server, defineRoute, defineRoutes, json } from 'vafast'
import { Type as t } from '@sinclair/typebox'
import { jwt } from '../src'

const jwtMiddleware = jwt({
	name: 'jwt2',
	secret: 'aawdaowdoj',
	sub: 'auth',
	iss: 'saltyaom.com',
	exp: '7d',
	schema: t.Object({
		name: t.String(),
	}),
})

type Jwt2Request = Request & {
	jwt2: {
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
			const token = await (req as Jwt2Request).jwt2.sign({ name: params.name })

			return json(
				{ message: `Sign in as ${params.name}` },
				200,
				{
					'Set-Cookie': `auth=${token}; HttpOnly; Max-Age=${7 * 86400}; Path=/`,
				},
			)
		},
	}),
	defineRoute({
		method: 'GET',
		path: '/profile',
		middleware: [jwtMiddleware],
		handler: async ({ req }) => {
			const cookies = req.headers.get('cookie')
			const authCookie = cookies
				?.split(';')
				.find(c => c.trim().startsWith('auth='))
			const token = authCookie?.split('=')[1]

			const profile = await (req as Jwt2Request).jwt2.verify(token)

			if (!profile) {
				return json({ error: 'Unauthorized' }, 401)
			}

			return json({ message: `Hello ${profile.name}` })
		},
	}),
])

const server = new Server(routes)

export default {
	fetch: (req: Request) => server.fetch(req),
}
