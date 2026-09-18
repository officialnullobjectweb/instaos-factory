import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: [
    "/",
    "/queue/:path*",
    "/schedule/:path*",
    "/analytics/:path*",
    "/templates/:path*",
    "/studio/:path*",
    "/experiments/:path*",
    "/settings/:path*",
  ],
};
