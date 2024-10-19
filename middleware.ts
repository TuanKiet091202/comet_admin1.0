import { authMiddleware } from "@clerk/nextjs";
import { NextRequest, NextResponse, NextFetchEvent } from "next/server";

// Middleware chính
export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent
): Promise<NextResponse> {
  // Xử lý CORS trước khi đi vào logic khác
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Thực hiện xác thực thông qua Clerk
  const handler = authMiddleware({
    publicRoutes: ["/api/:path*", "/ws/:path*"],
  });

  // Gọi authMiddleware và truyền req cùng event vào
  const response = await handler(req, event);

  // Đảm bảo trả về NextResponse
  if (response instanceof Response) {
    return new NextResponse(response.body, {
      status: response.status,
      headers: response.headers,
    });
  }

  // Trả về mặc định nếu không có response hợp lệ
  return response || NextResponse.json({ error: "Unexpected response" }, { status: 500 });
}

// Hàm xử lý CORS riêng biệt
function handleCors(req: NextRequest) {
  const headers = new Headers();
  headers.set(
    "Access-Control-Allow-Origin",
    process.env.ALLOWED_ORIGIN || "https://comet-store.vercel.app"
  );
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Credentials", "true");

  // Xử lý request OPTIONS (preflight)
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }
  return null; // Tiếp tục nếu không phải OPTIONS request
}

// Cấu hình matcher cho middleware
export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", // Bỏ qua static files và _next
    "/",                      // Áp dụng cho route gốc
    "/(api|trpc)(.*)",         // Áp dụng cho API và trpc routes
  ],
};
