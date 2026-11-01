import { NextResponse, type NextRequest } from 'next/server'
import { decideGate, PREVIEW_COOKIE, PREVIEW_COOKIE_MAX_AGE } from './lib/launch-gate'

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const decision = await decideGate({
    pathname,
    previewKeyParam: searchParams.get('key'),
    cookie: request.cookies.get(PREVIEW_COOKIE)?.value,
    env: {
      appOpen: process.env.APP_OPEN,
      nodeEnv: process.env.NODE_ENV,
      previewKey: process.env.PREVIEW_KEY,
    },
  })

  switch (decision.type) {
    case 'next':
      return NextResponse.next()
    case 'rewrite': {
      const res = NextResponse.rewrite(new URL(decision.to, request.url))
      res.headers.set('cache-control', 'no-store')
      return res
    }
    case 'redirect': {
      const res = NextResponse.redirect(new URL(decision.to, request.url))
      res.headers.set('cache-control', 'no-store')
      if (decision.setPreviewCookie) {
        res.cookies.set(PREVIEW_COOKIE, decision.setPreviewCookie, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: PREVIEW_COOKIE_MAX_AGE,
        })
      }
      return res
    }
    case 'json':
      return NextResponse.json(decision.body, { status: decision.status, headers: { 'cache-control': 'no-store' } })
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
