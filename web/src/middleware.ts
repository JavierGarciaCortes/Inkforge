import { defineMiddleware } from "astro/middleware";
import { validateToken, getCookieName } from "@lib/auth";

const PUBLIC_ROUTES = new Set(["/login", "/_vercel"]);

export const onRequest = defineMiddleware(
  ({ request, redirect, cookies, locals }, next) => {
    const url = new URL(request.url);
    const path = url.pathname;

    if (PUBLIC_ROUTES.has(path)) return next();
    if (path.startsWith("/_")) return next();

    const token = cookies.get(getCookieName())?.value;
    if (!validateToken(token)) return redirect("/login");

    return next();
  }
);
