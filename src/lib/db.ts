import { newId, type CodeStatus, type DeviceCategory, type ErrorCorrection } from "./domain";

export interface User { id: string; email: string; display_name: string; status: "active" | "disabled"; password_salt: string; password_hash: string; }
export interface Session { id: string; user_id: string; csrf_token: string; expires_at: string; }
export interface CodeRecord { id: string; owner_id: string; name: string; slug: string; foreground: string; background: string; error_correction: ErrorCorrection; logo_key: string | null; logo_content_type: string | null; status: CodeStatus; version: number; destination_url: string; total_scans: number; created_at: string; updated_at: string; }

export function envFrom(locals: App.Locals): Env {
  const env = locals.runtime?.env;
  if (!env?.DB) throw new Error("Zimaxx QR database binding is unavailable.");
  return env;
}

export async function findUserByEmail(db: D1Database, email: string): Promise<User | null> {
  return db.prepare("SELECT id,email,display_name,status,password_salt,password_hash FROM users WHERE email=? COLLATE NOCASE").bind(email.trim()).first<User>();
}

export async function createSession(db: D1Database, userId: string, tokenHash: string, csrf: string, now = new Date()): Promise<Session> {
  const session = { id: newId("ses"), user_id: userId, csrf_token: csrf, expires_at: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString() };
  await db.prepare("INSERT INTO sessions(id,token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?,?)").bind(session.id, tokenHash, userId, csrf, session.expires_at, now.toISOString()).run();
  return session;
}

export async function sessionUser(db: D1Database, tokenHash: string, now = new Date()): Promise<{ user: User; session: Session } | null> {
  return db.prepare(`SELECT u.id,u.email,u.display_name,u.status,u.password_salt,u.password_hash,s.id AS session_id,s.user_id,s.csrf_token,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'`).bind(tokenHash, now.toISOString()).first<any>().then((row) => row ? { user: row, session: { id: row.session_id, user_id: row.user_id, csrf_token: row.csrf_token, expires_at: row.expires_at } } : null);
}

export async function revokeSession(db: D1Database, sessionId: string) { await db.prepare("UPDATE sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL").bind(new Date().toISOString(), sessionId).run(); }

export async function listCodes(db: D1Database, ownerId: string): Promise<CodeRecord[]> {
  const { results } = await db.prepare(`SELECT c.*,r.destination_url,COUNT(s.id) AS total_scans FROM codes c JOIN redirect_rules r ON r.code_id=c.id AND r.valid_to IS NULL LEFT JOIN scan_events s ON s.code_id=c.id WHERE c.owner_id=? AND c.status!='archived' GROUP BY c.id ORDER BY c.updated_at DESC`).bind(ownerId).all<CodeRecord>();
  return results;
}

export async function getCode(db: D1Database, ownerId: string, id: string): Promise<CodeRecord | null> {
  return db.prepare(`SELECT c.*,r.destination_url,COUNT(s.id) AS total_scans FROM codes c JOIN redirect_rules r ON r.code_id=c.id AND r.valid_to IS NULL LEFT JOIN scan_events s ON s.code_id=c.id WHERE c.owner_id=? AND c.id=? GROUP BY c.id`).bind(ownerId, id).first<CodeRecord>();
}

export async function createCode(db: D1Database, input: { ownerId: string; name: string; slug: string; destination: string; foreground: string; background: string; errorCorrection: ErrorCorrection; idempotencyKey: string; }) {
  const now = new Date().toISOString(); const id = newId("code"); const ruleId = newId("rr"); const auditId = newId("aud");
  await db.batch([
    db.prepare("INSERT INTO codes(id,owner_id,name,slug,foreground,background,error_correction,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'active',?,?)").bind(id,input.ownerId,input.name,input.slug,input.foreground,input.background,input.errorCorrection,now,now),
    db.prepare("INSERT INTO redirect_rules(id,code_id,revision,destination_url,valid_from,changed_by,created_at) VALUES(?,?,1,?,?,?,?)").bind(ruleId,id,input.destination,now,input.ownerId,now),
    db.prepare("INSERT INTO audit_log(id,owner_id,code_id,action,idempotency_key,metadata_json,created_at) VALUES(?,?,?,'code.created',?,'{}',?)").bind(auditId,input.ownerId,id,input.idempotencyKey,now),
  ]);
  return id;
}

export async function updateCode(db: D1Database, current: CodeRecord, input: { ownerId: string; name: string; destination: string; foreground: string; background: string; errorCorrection: ErrorCorrection; expectedVersion: number; idempotencyKey: string; }) {
  const now = new Date().toISOString(); const changedDestination = current.destination_url !== input.destination;
  const statements = [
    db.prepare("UPDATE codes SET name=?,foreground=?,background=?,error_correction=?,version=version+1,updated_at=? WHERE id=? AND owner_id=? AND version=? AND status!='archived'").bind(input.name,input.foreground,input.background,input.errorCorrection,now,current.id,input.ownerId,input.expectedVersion),
  ];
  if (changedDestination) {
    const revision = await db.prepare("SELECT MAX(revision) AS revision FROM redirect_rules WHERE code_id=?").bind(current.id).first<{ revision: number }>();
    statements.push(db.prepare("UPDATE redirect_rules SET valid_to=? WHERE code_id=? AND valid_to IS NULL").bind(now,current.id));
    statements.push(db.prepare("INSERT INTO redirect_rules(id,code_id,revision,destination_url,valid_from,changed_by,created_at) VALUES(?,?,?,?,?,?,?)").bind(newId("rr"),current.id,(revision?.revision??0)+1,input.destination,now,input.ownerId,now));
  }
  statements.push(db.prepare("INSERT INTO audit_log(id,owner_id,code_id,action,idempotency_key,metadata_json,created_at) VALUES(?,?,?,'code.updated',?,?,?)").bind(newId("aud"),input.ownerId,current.id,input.idempotencyKey,JSON.stringify({destinationChanged:changedDestination}),now));
  const result = await db.batch(statements); if (!result[0].meta.changes) throw new Error("The code changed in another tab. Reload and try again.");
}

export async function setCodeStatus(db: D1Database, ownerId: string, id: string, status: CodeStatus, idempotencyKey: string) {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE codes SET status=?,updated_at=?,version=version+1 WHERE id=? AND owner_id=? AND status!='archived'").bind(status,now,id,ownerId),
    db.prepare("INSERT OR IGNORE INTO audit_log(id,owner_id,code_id,action,idempotency_key,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)").bind(newId("aud"),ownerId,id,`code.${status}`,idempotencyKey,"{}",now),
  ]);
}

export async function publicCode(db: D1Database, slug: string): Promise<{id:string;status:CodeStatus;destination_url:string}|null> { return db.prepare("SELECT c.id,c.status,r.destination_url FROM codes c JOIN redirect_rules r ON r.code_id=c.id AND r.valid_to IS NULL WHERE c.slug=? COLLATE NOCASE").bind(slug).first(); }
export async function recordScan(db: D1Database, codeId: string, category: DeviceCategory, now = new Date()) { await db.prepare("INSERT INTO scan_events(id,code_id,occurred_at,occurred_date,device_category) VALUES(?,?,?,?,?)").bind(newId("scan"),codeId,now.toISOString(),now.toISOString().slice(0,10),category).run(); }

export async function analytics(db: D1Database, ownerId: string) {
  const { results } = await db.prepare(`SELECT c.id,c.name,c.slug,se.occurred_date,COUNT(se.id) scans FROM codes c LEFT JOIN scan_events se ON se.code_id=c.id AND se.occurred_date>=date('now','-29 days') WHERE c.owner_id=? AND c.status!='archived' GROUP BY c.id,se.occurred_date ORDER BY se.occurred_date`).bind(ownerId).all<{id:string;name:string;slug:string;occurred_date:string|null;scans:number}>();
  return results;
}
