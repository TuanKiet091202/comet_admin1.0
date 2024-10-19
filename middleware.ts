import { authMiddleware } from "@clerk/nextjs";
 
export default authMiddleware({
  publicRoutes: ["/api/:path*", "/ws/:path*"]
});

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",  
    "/",                       
    "/(api|trpc)(.*)",         
  ],
};