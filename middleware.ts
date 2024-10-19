import { authMiddleware } from "@clerk/nextjs";
import { NextRequest, NextResponse } from "next/server";

const handler = authMiddleware({
  publicRoutes: ["/api/:path*", "/ws/:path*"],
});

export default async function middleware(req: NextRequest, event: any) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://comet-store.vercel.app";

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "https://comet-store.vercel.app",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }

  // Chuyển tiếp qua authMiddleware cho các yêu cầu khác
  return handler(req, event);
}

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
