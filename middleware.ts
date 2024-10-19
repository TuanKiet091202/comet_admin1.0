import { authMiddleware } from "@clerk/nextjs";
import { NextRequest, NextResponse } from "next/server";

const handler = authMiddleware({
  publicRoutes: ["/api/:path*", "/ws/:path*"],
});

export default async function middleware(
  req: NextRequest,
  event: any
): Promise<NextResponse> {
  // Handle preflight OPTIONS requests with appropriate CORS headers
  if (req.method === "OPTIONS") {
    return NextResponse.json(
      { message: "Preflight OK" },
      {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://comet-store.vercel.app/",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }

  // Execute authMiddleware for other requests
  const response = await handler(req, event);

  // Ensure a valid NextResponse is returned
  if (response instanceof Response) {
    // Convert standard Response to NextResponse if needed
    return new NextResponse(response.body, {
      status: response.status,
      headers: response.headers,
    });
  }

  // If handler returns void or undefined, default to a NextResponse
  return (
    response ||
    NextResponse.json({ error: "Unexpected response" }, { status: 500 })
  );
}

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", // Exclude static files and _next
    "/",                      // Apply to the root route
    "/(api|trpc)(.*)",         // Apply to API and trpc routes
  ],
};
