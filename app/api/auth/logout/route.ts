import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.redirect(new URL("/login?loggedOut=1", "http://localhost:3000"));

  response.cookies.set("session", "", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return response;
}