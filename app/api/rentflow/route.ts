import { NextRequest, NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_RENTFLOW_API!;

export async function GET(req: NextRequest) {
  try {
    const incomingUrl = new URL(req.url);
    const target = new URL(APPS_SCRIPT_URL);

    incomingUrl.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    const res = await fetch(target.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Proxy GET failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body,
      cache: "no-store",
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Proxy POST failed" },
      { status: 500 }
    );
  }
}

