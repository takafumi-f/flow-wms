import { auth } from '@/lib/auth';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const isAuthPage = nextUrl.pathname.startsWith('/login');
  const isApiRoute = nextUrl.pathname.startsWith('/api');

  if (isApiRoute) return;

  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL('/login', nextUrl));
  }

  if (isLoggedIn && isAuthPage) {
    return Response.redirect(new URL('/', nextUrl));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
};
