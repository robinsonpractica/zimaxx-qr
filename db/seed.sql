INSERT OR IGNORE INTO users(id,email,display_name,password_salt,password_hash,status,role,created_at,updated_at) VALUES
('usr_maya','demo@zimmax.test','Zimmax Team','squarecode-demo-salt','6adb01a35bd11730fe0bcc8b923a1f74c4d2fe9427bb9600c505234130bb9f6f','active','admin','2026-08-01T12:00:00.000Z','2026-08-01T12:00:00.000Z'),
('usr_noah','qa@zimmax.test','Zimmax QA','squarecode-demo-salt','6adb01a35bd11730fe0bcc8b923a1f74c4d2fe9427bb9600c505234130bb9f6f','active','editor','2026-08-01T12:00:00.000Z','2026-08-01T12:00:00.000Z')
ON CONFLICT(email) DO UPDATE SET password_salt=excluded.password_salt,password_hash=excluded.password_hash,status='active',role=excluded.role,updated_at=excluded.updated_at;

INSERT OR IGNORE INTO codes(id,owner_id,name,slug,foreground,background,error_correction,status,version,created_at,updated_at) VALUES
('code_menu','usr_maya','Digital catalogue','spring-menu','#17170F','#FFFFFF','Q','active',1,'2026-08-01T12:00:00.000Z','2026-08-17T12:00:00.000Z'),
('code_van','usr_maya','Zimmax van','van','#17170F','#FFFFFF','H','active',2,'2026-08-03T12:00:00.000Z','2026-08-18T12:00:00.000Z'),
('code_counter','usr_maya','Counter cards','counter','#9C3F2B','#FFFFFF','M','disabled',1,'2026-08-05T12:00:00.000Z','2026-08-15T12:00:00.000Z'),
('code_private','usr_noah','Noah private code','noah-private','#111827','#FFFFFF','M','active',1,'2026-08-02T12:00:00.000Z','2026-08-02T12:00:00.000Z');

INSERT OR IGNORE INTO redirect_rules(id,code_id,revision,destination_url,valid_from,valid_to,changed_by,created_at) VALUES
('rr_menu_1','code_menu',1,'https://example.com/menu/spring','2026-08-01T12:00:00.000Z',NULL,'usr_maya','2026-08-01T12:00:00.000Z'),
('rr_van_1','code_van',1,'https://example.com/catalog','2026-08-03T12:00:00.000Z','2026-08-18T12:00:00.000Z','usr_maya','2026-08-03T12:00:00.000Z'),
('rr_van_2','code_van',2,'https://wa.me/584120000000?text=Hola%20Zimmax','2026-08-18T12:00:00.000Z',NULL,'usr_maya','2026-08-18T12:00:00.000Z'),
('rr_counter_1','code_counter',1,'https://example.com/loyalty','2026-08-05T12:00:00.000Z',NULL,'usr_maya','2026-08-05T12:00:00.000Z'),
('rr_private_1','code_private',1,'https://example.com/private','2026-08-02T12:00:00.000Z',NULL,'usr_noah','2026-08-02T12:00:00.000Z');

WITH RECURSIVE days(n,d) AS (SELECT 0,date('2026-08-18') UNION ALL SELECT n+1,date(d,'-1 day') FROM days WHERE n<29), events(n,d) AS (SELECT 1,d FROM days UNION ALL SELECT n+1,d FROM events WHERE n < (CASE WHEN substr(d,9,2)%3=0 THEN 8 ELSE 4 END)) INSERT OR IGNORE INTO scan_events(id,code_id,occurred_at,occurred_date,device_category) SELECT 'seed-menu-'||replace(d,'-','')||'-'||n,'code_menu',d||'T14:00:00.000Z',d,CASE WHEN n%3=0 THEN 'desktop' ELSE 'mobile' END FROM events;
WITH RECURSIVE days(n,d) AS (SELECT 0,date('2026-08-18') UNION ALL SELECT n+1,date(d,'-1 day') FROM days WHERE n<29), events(n,d) AS (SELECT 1,d FROM days UNION ALL SELECT n+1,d FROM events WHERE n < (CASE WHEN substr(d,9,2)%4=0 THEN 5 ELSE 2 END)) INSERT OR IGNORE INTO scan_events(id,code_id,occurred_at,occurred_date,device_category) SELECT 'seed-van-'||replace(d,'-','')||'-'||n,'code_van',d||'T16:00:00.000Z',d,'mobile' FROM events;
