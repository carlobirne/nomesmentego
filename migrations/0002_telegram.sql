-- Avvisi su Telegram.
-- Codici usa-e-getta per collegare una chat: valgono un'ora.
CREATE TABLE telegram_codici (
  codice      TEXT PRIMARY KEY,
  bacheca_id  TEXT NOT NULL REFERENCES bacheche(id) ON DELETE CASCADE,
  modifica    INTEGER NOT NULL DEFAULT 0,  -- 1 se creato da chi può modificare: abilita il tasto "Fatto"
  origine     TEXT NOT NULL,               -- indirizzo dell'app, per i link nei messaggi
  scade       TEXT NOT NULL
);

-- Chat (persone o gruppi) che ricevono gli avvisi di una bacheca.
CREATE TABLE telegram_iscrizioni (
  bacheca_id  TEXT NOT NULL REFERENCES bacheche(id) ON DELETE CASCADE,
  chat_id     TEXT NOT NULL,
  nome        TEXT NOT NULL,
  modifica    INTEGER NOT NULL DEFAULT 0,
  origine     TEXT NOT NULL,
  filtro      TEXT,                        -- JSON con gli id dei gruppi da ricevere; NULL = tutto
  ultimo      TEXT NOT NULL,               -- "AAAA-MM-GGTHH:MM" (ora locale): avvisi fino a qui già mandati
  creata      TEXT NOT NULL,
  PRIMARY KEY (bacheca_id, chat_id)
);
CREATE INDEX telegram_iscrizioni_chat ON telegram_iscrizioni(chat_id);
