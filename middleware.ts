import { authMiddleware } from "@clerk/nextjs";
import { NextRequest, NextResponse, NextFetchEvent } from "next/server";

// Sử dụng middleware của Clerk với các route công khai.
const handler = authMiddleware({
  publicRoutes: ["/api/:path*", "/ws/:path*"],
});

// Middleware chính
export default async function middleware(req: NextRequest, event: NextFetchEvent): Promise<NextResponse> {
  const origin = req.headers.get("origin");

  // Các origin được phép
  const allowedOrigins = [
    "https://comet-store.vercel.app",
    "https://www.comet-store.vercel.app",
  ];

  if (origin && !allowedOrigins.includes(origin)) {
    return new NextResponse("Origin not allowed", { status: 403 });
  }

  // Xử lý preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return NextResponse.json(
      { message: "Preflight OK" },
      {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin || "",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }

  // Gọi authMiddleware với đúng 2 tham số
  const response = await handler(req, event);

  // Chuyển đổi nếu response là Response thay vì NextResponse
  if (response instanceof Response) {
    return new NextResponse(response.body, {
      status: response.status,
      headers: response.headers,
    });
  }

  // Trả về response hoặc lỗi mặc định
  return (
    response || NextResponse.json({ error: "Unexpected response" }, { status: 500 })
  );
}

// Cấu hình matcher
export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", // Bỏ qua static files và _next
    "/",                      // Áp dụng cho root route
    "/(api|trpc)(.*)",         // Áp dụng cho API và trpc routes
  ],
};
