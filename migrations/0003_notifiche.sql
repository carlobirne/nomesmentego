-- Impostazioni del server (per esempio le chiavi VAPID delle notifiche, create da sole al primo uso)
-- e modelli delle email per bacheca ("email-modello:<id bacheca>").
CREATE TABLE impostazioni (
  chiave  TEXT PRIMARY KEY,
  valore  TEXT NOT NULL
);

-- Destinatari delle notifiche dell'app (canale "push": un telefono o un browser)
-- e delle email (canale "email": un indirizzo).
CREATE TABLE notifiche (
  id           TEXT PRIMARY KEY,
  bacheca_id   TEXT NOT NULL REFERENCES bacheche(id) ON DELETE CASCADE,
  canale       TEXT NOT NULL,              -- 'push' | 'email'
  destinazione TEXT NOT NULL,              -- endpoint del browser oppure indirizzo email
  chiavi       TEXT,                       -- push: JSON { p256dh, auth }
  nome         TEXT NOT NULL,
  stato        TEXT NOT NULL,              -- 'attivo' | 'da-confermare'
  token        TEXT NOT NULL UNIQUE,       -- email: per confermare e disiscriversi
  origine      TEXT NOT NULL,              -- indirizzo dell'app, per i link
  filtro       TEXT,                       -- JSON con gli id dei gruppi da ricevere; NULL = tutto
  ultimo       TEXT NOT NULL,              -- "AAAA-MM-GGTHH:MM" (ora locale): avvisi fino a qui già mandati
  creata       TEXT NOT NULL,
  UNIQUE (bacheca_id, canale, destinazione)
);
CREATE INDEX notifiche_canale ON notifiche(canale, stato);
