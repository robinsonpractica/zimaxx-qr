UPDATE users SET email = 'demo@zimmax.test', display_name = 'Zimmax Team', updated_at = datetime('now') WHERE id = 'usr_maya';
UPDATE users SET email = 'qa@zimmax.test', display_name = 'Zimmax QA', updated_at = datetime('now') WHERE id = 'usr_noah';
UPDATE codes SET name = 'Zimmax van', foreground = '#17170F', updated_at = datetime('now') WHERE id = 'code_van';
UPDATE codes SET name = 'Digital catalogue', foreground = '#17170F', updated_at = datetime('now') WHERE id = 'code_menu';
UPDATE redirect_rules SET destination_url = 'https://wa.me/584120000000?text=Hola%20Zimmax' WHERE id = 'rr_van_2';
PRAGMA optimize;
