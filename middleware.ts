import { authMiddleware } from "@clerk/nextjs";
import { NextRequest, NextResponse } from "next/server";

const handler = authMiddleware({
  publicRoutes: ["/api/:path*", "/ws/:path*"],
});

export default async function middleware(
  req: NextRequest,
  event: any
): Promise<NextResponse> {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://comet-store.vercel.app";

  // Xử lý preflight OPTIONS request với CORS headers
  if (req.method === "OPTIONS") {
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    return response;
  }

  // Các request khác được xử lý bởi authMiddleware
  const response = await handler(req, event) as NextResponse;

  // Kiểm tra và gán thêm header CORS cho response
  if (response) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", // Bỏ qua static files và _next
    "/",                      // Áp dụng middleware cho root
    "/(api|trpc)(.*)",         // Áp dụng middleware cho API và trpc routes
  ],
};
