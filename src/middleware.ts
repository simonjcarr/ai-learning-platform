import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/articles/(.*)/chat(.*)',
  '/api/articles/(.*)/generate',
  '/api/articles/(.*)/like',
  '/api/articles/(.*)/view',
  '/api/articles/(.*)/lists',
  '/api/articles/(.*)/suggest',
  '/api/articles/(.*)/flag',
  '/admin(.*)',
  '/api/admin(.*)',
]);

const isProtectedAPIRoute = createRouteMatcher([
  '/api/articles/(.*)/comments'
]);

const isCommentWriteRequest = (req: Request): boolean => {
  return req.method === 'POST' && req.url.includes('/comments');
};

const isWebhookRoute = createRouteMatcher([
  '/api/webhook(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  
  // Allow webhook routes without authentication
  if (isWebhookRoute(req)) {
    return NextResponse.next();
  }

  // Special handling for comment routes - only protect POST requests
  if (isProtectedAPIRoute(req)) {
    if (isCommentWriteRequest(req) && !userId) {
      return NextResponse.json(
        { error: "Authentication required to create comments" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Protect routes that require authentication
  if (isProtectedRoute(req) && !userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};