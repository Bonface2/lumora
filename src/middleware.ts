import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const SELLER_PATHS = ["/seller"];
const BUYER_PATHS = ["/buyer"];
const ADMIN_PATHS = ["/admin"];
const AUTH_PATHS = ["/login", "/register"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isAuthenticated = !!session?.user;
  const role = session?.user?.role;

  if (pathname === "/" && isAuthenticated) {
    const dest = role === "SELLER" ? "/seller" : role === "ADMIN" ? "/admin" : "/buyer";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if (AUTH_PATHS.some((p) => pathname.startsWith(p)) && isAuthenticated) {
    const dest = role === "SELLER" ? "/seller" : role === "ADMIN" ? "/admin" : "/buyer";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if (SELLER_PATHS.some((p) => pathname.startsWith(p))) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${pathname}`, req.url));
    }
    if (role !== "SELLER" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (BUYER_PATHS.some((p) => pathname.startsWith(p))) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${pathname}`, req.url));
    }
  }

  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${pathname}`, req.url));
    }
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
