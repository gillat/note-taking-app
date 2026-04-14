const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDb(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL DEFAULT '',
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        )
      `);
      console.log('Database connected');
      return;
    } catch (err) {
      console.log(`Waiting for database... (attempt ${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  throw new Error('Could not connect to database');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Disable caching for API routes
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// List all notes (sorted by updated_at desc)
app.get('/api/notes', async (req, res) => {
  const { q } = req.query;
  let result;
  if (q) {
    const pattern = `%${q}%`;
    result = await pool.query(
      'SELECT * FROM notes WHERE title ILIKE $1 OR body ILIKE $2 ORDER BY updated_at DESC',
      [pattern, pattern]
    );
  } else {
    result = await pool.query('SELECT * FROM notes ORDER BY updated_at DESC');
  }
  res.json(result.rows);
});

// Get a single note
app.get('/api/notes/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM notes WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// Create a note
app.post('/api/notes', async (req, res) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  const { title = '', body = '' } = req.body;
  await pool.query(
    'INSERT INTO notes (id, title, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
    [id, title, body, now, now]
  );
  res.status(201).json({ id, title, body, created_at: now, updated_at: now });
});

// Update a note
app.put('/api/notes/:id', async (req, res) => {
  const { title, body } = req.body;
  const now = Date.now();
  const result = await pool.query(
    'UPDATE notes SET title = $1, body = $2, updated_at = $3 WHERE id = $4',
    [title, body, now, req.params.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ id: req.params.id, title, body, updated_at: now });
});

// Delete a note
app.delete('/api/notes/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM notes WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
