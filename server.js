const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const dbPath = process.env.DB_PATH || path.join(__dirname, 'notes.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// List all notes (sorted by updated_at desc)
app.get('/api/notes', (req, res) => {
  const { q } = req.query;
  let notes;
  if (q) {
    const pattern = `%${q}%`;
    notes = db.prepare(
      'SELECT * FROM notes WHERE title LIKE ? OR body LIKE ? ORDER BY updated_at DESC'
    ).all(pattern, pattern);
  } else {
    notes = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
  }
  res.json(notes);
});

// Get a single note
app.get('/api/notes/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Not found' });
  res.json(note);
});

// Create a note
app.post('/api/notes', (req, res) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  const { title = '', body = '' } = req.body;
  db.prepare(
    'INSERT INTO notes (id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, title, body, now, now);
  res.status(201).json({ id, title, body, created_at: now, updated_at: now });
});

// Update a note
app.put('/api/notes/:id', (req, res) => {
  const { title, body } = req.body;
  const now = Date.now();
  const result = db.prepare(
    'UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?'
  ).run(title, body, now, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ id: req.params.id, title, body, updated_at: now });
});

// Delete a note
app.delete('/api/notes/:id', (req, res) => {
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
