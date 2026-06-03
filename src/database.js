const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '..', 'conversations.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    phone TEXT PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'GREETING',
    data TEXT NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )
`);

function getConversation(phone) {
  const row = db.prepare('SELECT * FROM conversations WHERE phone = ?').get(phone);
  if (!row) return null;
  return { state: row.state, data: JSON.parse(row.data) };
}

function saveConversation(phone, state, data) {
  db.prepare(`
    INSERT INTO conversations (phone, state, data, updated_at)
    VALUES (?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(phone) DO UPDATE SET
      state = excluded.state,
      data = excluded.data,
      updated_at = excluded.updated_at
  `).run(phone, state, JSON.stringify(data));
}

function deleteConversation(phone) {
  db.prepare('DELETE FROM conversations WHERE phone = ?').run(phone);
}

module.exports = { getConversation, saveConversation, deleteConversation };
