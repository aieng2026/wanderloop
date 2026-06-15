import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  const url = new URL(req.url);
  url.pathname = "/";
  url.search = "";
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
