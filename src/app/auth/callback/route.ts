import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * OAuth callback. Supabase redirects here with a `code` query param after the
 * user approves access at the provider. Exchanging that code sets the session
 * cookies, after which the user is a normal authenticated visitor.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Behind Vercel's proxy the request host is internal, so prefer the
  // forwarded host when building absolute redirects in production.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const baseUrl =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? origin
      : `https://${forwardedHost}`;

  const loginWithError = (message: string) =>
    NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(message)}`);

  // Provider-side failures (user pressed "cancel", misconfigured consent
  // screen, etc.) come back as error params rather than a code.
  const providerError = searchParams.get("error");
  if (providerError) {
    return loginWithError(searchParams.get("error_description") || providerError);
  }

  const code = searchParams.get("code");
  if (!code) {
    return loginWithError("No authorization code was returned.");
  }

  // Only allow relative paths so a crafted link cannot redirect off-site.
  const nextParam = searchParams.get("next");
  const redirectTo = nextParam?.startsWith("/") ? nextParam : "/";

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return loginWithError(error.message);
  }

  return NextResponse.redirect(`${baseUrl}${redirectTo}`);
}
