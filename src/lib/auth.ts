import type { APIContext } from "astro";
import { createSession, envFrom, findUserByEmail, revokeSession, sessionUser, type Session, type User } from "./db";

const COOKIE = "sq_session";
const enc = new TextEncoder();
function hex(bytes: ArrayBuffer) { return [...new Uint8Array(bytes)].map((b)=>b.toString(16).padStart(2,"0")).join(""); }
async function sha256(value: string) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(value))); }

export async function verifyPassword(password: string, salt: string, expected: string) {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:enc.encode(salt),iterations:100000}, material, 256));
  let diff = derived.length ^ expected.length; for (let i=0;i<Math.min(derived.length,expected.length);i++) diff |= derived.charCodeAt(i)^expected.charCodeAt(i); return diff===0;
}

export async function currentIdentity(context: Pick<APIContext,"locals"|"cookies">): Promise<{user:User;session:Session}|null> {
  const raw = context.cookies.get(COOKIE)?.value; if (!raw) return null;
  return sessionUser(envFrom(context.locals).DB, await sha256(raw));
}

export async function login(context: APIContext, email: string, password: string) {
  const db=envFrom(context.locals).DB; const user=await findUserByEmail(db,email);
  if (!user || user.status!=="active" || !(await verifyPassword(password,user.password_salt,user.password_hash))) return null;
  const raw=crypto.randomUUID()+crypto.randomUUID(); const csrf=crypto.randomUUID(); const session=await createSession(db,user.id,await sha256(raw),csrf);
  context.cookies.set(COOKIE,raw,{httpOnly:true,sameSite:"lax",secure:context.url.protocol==="https:",path:"/",maxAge:8*60*60}); return {user,session};
}
export async function logout(context: APIContext) { const identity=await currentIdentity(context); if(identity) await revokeSession(envFrom(context.locals).DB,identity.session.id); context.cookies.delete(COOKIE,{path:"/"}); }
export function validCsrf(request: Request, session: Session, form: FormData) { const origin=request.headers.get("origin"); const expected=new URL(request.url).origin; return (!origin||origin===expected)&&form.get("csrf")===session.csrf_token; }
