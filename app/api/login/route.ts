import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  MAX_AGE_S,
  signSession,
  timingSafeEqualStr,
} from "@/lib/auth";

function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/plan";
  return next;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/plan"));

  const expectedEmail = process.env.ADMIN_EMAIL ?? "";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "";

  const ok =
    expectedEmail.length > 0 &&
    expectedPassword.length > 0 &&
    timingSafeEqualStr(email.toLowerCase(), expectedEmail.toLowerCase()) &&
    timingSafeEqualStr(password, expectedPassword);

  if (!ok) {
    const url = new URL(req.url);
    url.pathname = "/login";
    url.search = `?error=invalid&next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(url, 303);
  }

  const token = await signSession(email.toLowerCase());
  const url = new URL(next, req.url);
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
  return res;
}
