import { authMiddleware } from "@clerk/nextjs";
import { NextRequest, NextResponse } from "next/server";

const handler = authMiddleware({
  publicRoutes: ["/api/:path*", "/ws/:path*"],
});

export default async function middleware(req: NextRequest, event: any) {
  // Xử lý preflight OPTIONS request nếu không được Vercel tự xử lý
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204 });
  }

  // Tiếp tục qua authMiddleware cho các request khác
  return handler(req, event);
}

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", // Bỏ qua các static files và _next
    "/",                      // Áp dụng middleware cho root
    "/(api|trpc)(.*)",         // Áp dụng middleware cho API và trpc routes
  ],
};
