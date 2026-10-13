-- Una riga per bacheca. Il link di modifica è salvato solo come impronta (SHA-256):
-- chi legge il database non può ricavarlo. Il link di sola lettura serve anche per il feed.
CREATE TABLE bacheche (
  id               TEXT PRIMARY KEY,
  hash_modifica    TEXT NOT NULL UNIQUE,
  token_lettura    TEXT NOT NULL UNIQUE,
  dati             TEXT NOT NULL,
  versione         INTEGER NOT NULL DEFAULT 1,
  creata           TEXT NOT NULL,
  aggiornata       TEXT NOT NULL
);

-- Copie di sicurezza automatiche (al massimo una ogni 10 minuti, le ultime 30).
CREATE TABLE storico (
  bacheca_id  TEXT NOT NULL REFERENCES bacheche(id) ON DELETE CASCADE,
  versione    INTEGER NOT NULL,
  dati        TEXT NOT NULL,
  salvata     TEXT NOT NULL,
  PRIMARY KEY (bacheca_id, versione)
);
