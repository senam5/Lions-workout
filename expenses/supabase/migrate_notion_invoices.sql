-- One-time migration: Notion "🦁 Lion Summer 2026 — Dépenses" database -> expenses table.
-- Run this ONCE in the Supabase SQL Editor, after schema.sql has already been run.
--
-- Skipped from the source data (not migrated, on purpose):
--   - "Frais Jamboree — exemple de dépense" — explicitly marked as a placeholder example row.
--   - "Coach felix contrat" — completely empty row (no amount, no date, no vendor).
--
-- NOTE: receipt_path is left NULL for all of these. The original Notion rows had
-- attached receipt images/PDFs, but those aren't carried over automatically —
-- re-attaching them would need to be done per-row (open the Notion page, download
-- the file, upload it here). Ask if you want that done for specific high-value ones.

insert into public.expenses (user_id, spent_on, vendor, category, amount, note) values
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-24', 'Oumar Racine Diop', 'Autre', 60, 'Arbitre — part Senam (moitié) — Match du 24 juin'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-08', 'Senam Gbekou', 'Salaires', 1000, 'Paie — Senam (virement Interac)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-07', 'Senam Gbekou', 'Tournois', 500, 'Retrait cash — tournoi Capitale National (Interac)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-05-23', 'VEVOR', 'Équipement', 149.40, 'VEVOR Electric Grain Mill Grinder 3000W — Moulin à grains'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-05-15', 'Coach Felix', 'Salaires', 800, 'Salaire Coach Felix — 4 premières semaines'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-05-23', 'SSVSN Media', 'Contenu / Média', 50, 'Photographe — SSVSN Media'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-05-15', 'Coach Ask (Ash Khan)', 'Salaires', 600, 'Salaire Coach Ash — 3 premières semaines'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-07-01', 'Oumar Racine Diop', 'Autre', 60, 'Arbitre — part Senam (moitié) — Match du 1er juillet'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-07-02', 'Paul Tita', 'Autre', 20, 'Marqueur — Paul Tita (match du 24 juin)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-07-04', 'Senam Gbekou', 'Salaires', 1000, 'Paie — Senam (juillet)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-07-02', 'Louis Marqueur', 'Autre', 40, 'Marqueur — Louis Marqueur (matchs 24 juin + 1er juillet)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-07-07', 'Coach Quentin D3', 'Autre', 60, 'Arbitres — match d''exhibition Ste-Foy (Coach Quentin)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-07-13', 'Sami Shakibaian', 'Contenu / Média', 265, 'Vidéographie — Sami Shakibaian (Limoilou + STF + 5 edits)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-07-13', 'Simon Fontaine', 'Tournois', 500, 'Tournoi estival Brébeuf — frais d''inscription'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-07-31', 'Ashkan Markadeh (Ash Khan)', 'Salaires', 1200, 'Salaire Coach Ash — Paiement final (12 sessions)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-08-01', 'Carl Annan', 'Salaires', 465, 'Invoice #100 — Carl Annan (skills training, filming, edit)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-05-29', 'David Vergara', 'Contenu / Média', 60, 'Facture #001 — David Vergara (Graphic design templates)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-08-10', 'Félix-Arthur Robitaille', 'Salaires', 1200, 'Facture #102 — Coach Felix (head coach practice)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-29', 'Sami Shakibaian', 'Autre', 80, 'Paiement match Cegep Levis — Media team (SSVSN Media)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-05', 'Sami Shakibaian', 'Contenu / Média', 125, 'SSVSN Media — Photo shoot (Lions Men''s Basketball Team)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-07-01', 'APPLE.COM/BILL (CapCut)', 'Contenu / Média', 125.76, 'CapCut (Apple) — abonnement annuel — Lions'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-05', 'Ashkan Markadeh', 'Salaires', 600, 'Invoice #2 — Coaching & training (Ashkan Markadeh)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-18', 'Félix-Arthur Robitaille', 'Salaires', 1000, 'Invoice #100 — Félix-Arthur Robitaille — head coach practice'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-14', 'Sami Shakibaian', 'Contenu / Média', 45, 'SSVSN Media — Montage vidéo (Edit SLC vs UK Cut)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-18', 'Simon Fontaine', 'Autre', 60, 'Interac — Simon Fontaine — Match du 17 juin'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-16', 'Sami Shakibaian', 'Contenu / Média', 75, 'Facture 2026-004 — SSVSN Media — Sami Shakibaian (Photo/Video)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-23', 'Coach Ash', 'Salaires', 600, 'Salaire Coach Ash — période 5 juin au 26 juin (6x100$)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-06-24', 'David Vergara', 'Contenu / Média', 50, 'Facture #002 — David Vergara — Graphic design templates'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-08-13', 'Senam Magezi Gbekou (self)', 'Transfert', 500, 'Inter-company transfer — End of summer fund flush'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-08-20', 'David Vergara', 'Contenu / Média', 50, 'Invoice #003 — David Vergara, Graphic Design Services (2x $25) — STATUS: En attente (unpaid)'),
('97aadf44-09ca-41d5-8d93-b9eb8ec4f08d', '2026-08-20', 'Le Shoe Shop', 'Transfert', 157, 'Money transfer from Lions to the Shoe Shop');
