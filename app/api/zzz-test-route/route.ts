import { NextResponse } from "next/server";

export async function GET() {
  console.log("✅ zzz-test-route HIT");
  return NextResponse.json({
    ok: true,
    message: "zzz test route works",
  });
}