import {createServerClient} from "@supabase/ssr";
import {NextResponse, type NextRequest} from "next/server";

export async function proxy(request: NextRequest) {
 let response = NextResponse.next({request});

 const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
   cookies: {
    getAll() {
     return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
     cookiesToSet.forEach(({name, value}) => request.cookies.set(name, value));
     response = NextResponse.next({request});
     cookiesToSet.forEach(({name, value, options}) =>
      response.cookies.set(name, value, options),
     );
    },
   },
  },
 );

 // IMPORTANT: refresh session — use getClaims, not getSession or getUser.
 await supabase.auth.getClaims();

 return response;
}

export const config = {
 matcher: [
  // Skip static assets, Next internals, and route handlers. `/api/*` carries
  // its own auth. Server Actions post to their own page, so they still match.
  "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
 ],
};
