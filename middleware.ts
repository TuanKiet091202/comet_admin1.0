import { authMiddleware } from "@clerk/nextjs";
import { NextRequest, NextResponse } from "next/server";

const handler = authMiddleware({
  publicRoutes: ["/api/:path*", "/ws/:path*"],
});

export default async function middleware(req: NextRequest, event: any) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

  // Xử lý preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }

  // Các request khác sẽ được xử lý bởi authMiddleware
  return handler(req, event); // Truyền đủ 2 tham số req và event
}

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", // Bỏ qua các static files và _next
    "/",                      // Áp dụng middleware cho root
    "/(api|trpc)(.*)",         // Áp dụng middleware cho API và trpc routes
  ],
};
