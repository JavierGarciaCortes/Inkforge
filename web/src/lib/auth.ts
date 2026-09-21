import crypto from "node:crypto";

const USER = import.meta.env.AUTH_USER || "admin";
const PASS = import.meta.env.AUTH_PASS || "changeme";
const COOKIE_NAME = "auth_token";
const SECRET = import.meta.env.AUTH_SECRET || "fiction-vault";

export function checkCredentials(user: string, pass: string): boolean {
  return user === USER && pass === PASS;
}

export function createToken(): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${USER}:${PASS}`)
    .digest("hex");
}

export function validateToken(token: string | undefined): boolean {
  return token === createToken();
}

export function getCookieName(): string {
  return COOKIE_NAME;
}
