import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;

const pool = new Pool({
  host: PGHOST,
  database: PGDATABASE,
  user: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: {
    require: true,
  },
});

const PORT = process.env.PORT || 8000;

app.get('/getPassword', async (req, res) => {
  const userID = req.query.userID;
  if (!userID) return res.status(400).json({ message: 'userID is required' });
  try {
    const result = await pool.query('SELECT pass AS Password FROM users WHERE userId = $1', [userID]);
    if (result.rows.length > 0) res.json({ password: result.rows[0].password });
    else res.status(404).json({ message: 'User not found' });
  } catch (err) {
    res.status(500).json({ message: 'Database query failed' });
  }
});

app.get('/getUserId', async (req, res) => {
  const { userName } = req.query;
  if (!userName) return res.status(400).json({ message: 'userName is required' });
  try {
    const result = await pool.query('SELECT userId FROM users WHERE userName = $1', [userName]);
    if (result.rows.length > 0) res.json({ userID: result.rows[0].userid });
    else res.status(404).json({ message: 'User not found' });
  } catch (err) {
    res.status(500).json({ message: 'Database query failed' });
  }
});

app.get('/getLocation', async (req, res) => {
  const userID = req.query.userID;
  if (!userID) return res.status(400).json({ message: 'userID is required' });
  try {
    const result = await pool.query(
      'SELECT dest_lat AS latitude, dest_lon AS longitude, dest_name AS destination FROM sessions WHERE sessionId = (SELECT sessionId from session_users WHERE userId = $1)',
      [userID]
    );
    if (result.rows.length > 0) {
      res.json({ userId: userID, ...result.rows[0] });
    } else res.status(404).json({ message: 'User not found' });
  } catch (err) {
    res.status(500).json({ message: 'Database query failed' });
  }
});

app.get('/getUserLocation', async (req, res) => {
  const userID = req.query.userID;
  if (!userID) return res.status(400).json({ message: 'userID is required' });
  try {
    const result = await pool.query('SELECT Lat AS latitude, Lon AS longitude, userName AS Name FROM users WHERE userId = $1', [userID]);
    if (result.rows.length > 0) {
      res.json({ userId: userID, ...result.rows[0] });
    } else res.status(404).json({ message: 'User not found' });
  } catch (err) {
    res.status(500).json({ message: 'Database query failed' });
  }
});

app.get('/getUsers', async (req, res) => {
  const userID = req.query.userID;
  if (!userID) return res.status(400).json({ message: 'userID is required' });
  try {
    const result = await pool.query(
      'SELECT userId FROM session_users WHERE sessionId = (SELECT sessionId FROM session_users WHERE userId = $1) AND userId <> $1',
      [userID]
    );
    if (result.rows.length > 0) res.json({ users: result.rows });
    else res.status(404).json({ message: 'User not found' });
  } catch (err) {
    res.status(500).json({ message: 'Database query failed' });
  }
});

app.post('/putLocation', async (req, res) => {
  const { userID, latitude, longitude } = req.body;
  if (!userID || latitude === undefined || longitude === undefined) return res.status(400).json('userId, latitude and longitude are required');
  try {
    const result = await pool.query('UPDATE users SET Lat = $1, Lon = $2 WHERE userId = $3', [latitude, longitude, userID]);
    if (result.rowCount > 0) res.json({ message: 'Location updated successfully!' });
    else res.status(404).json({ message: 'User not found!' });
  } catch (err) {
    res.status(500).json('Database query failed!');
  }
});

app.get('/checkSessionExists', async (req, res) => {
  const { sessionID } = req.query;
  if (!sessionID) return res.status(400).json({ message: 'sessionID is required!' });
  try {
    const result = await pool.query('SELECT COUNT(*) AS sessionExists FROM sessions WHERE sessionId = $1', [sessionID]);
    res.json({ exists: result.rows[0].sessionexists === '1' ? 'true' : 'false' });
  } catch (err) {
    res.status(500).json({ message: 'Database query failed!' });
  }
});

app.post('/addSessionUser', async (req, res) => {
  const { userID, sessionID } = req.body;
  if (!userID || !sessionID) return res.status(400).json('userID and sessionID are required');
  try {
    const result = await pool.query('INSERT INTO session_users(sessionId, userId) VALUES($1, $2)', [sessionID, userID]);
    if (result.rowCount > 0) res.json({ message: 'User added in session successfully!' });
    else res.json({ message: 'Error adding user' });
  } catch (err) {
    res.status(500).json('Database query failed!');
  }
});

app.delete('/removeSessionUser', async (req, res) => {
  const { userID } = req.query;
  if (!userID) return res.status(400).json({ message: 'userID is required!' });
  try {
    const result = await pool.query('DELETE FROM session_users WHERE userId = $1', [userID]);
    if (result.rowCount > 0) res.json({ message: 'User removed from session successfully!' });
    else res.json({ message: 'Error removing user' });
  } catch (err) {
    res.status(500).json({ message: 'Database query failed!' });
  }
});

app.get('/checkBlock', async (req, res) => {
  const { userID } = req.query;
  if (!userID) return res.status(400).json({ message: 'userID is required!' });
  try {
    const result = await pool.query('SELECT isBlocked FROM users WHERE userId = $1', [userID]);
    if (result.rows.length > 0) res.json({ check: result.rows[0].isblocked });
    else res.status(404).json({ message: 'User not found!' });
  } catch (err) {
    res.status(500).json({ message: 'Database query failed!' });
  }
});

app.post('/createSession', async (req, res) => {
  const { userId, name, lat, lon } = req.body;
  if (!userId || !name || lat === undefined || lon === undefined) return res.status(400).json({ message: 'userId, name, lat and lon are required!' });
  try {
    const result = await pool.query('INSERT INTO sessions(dest_lat, dest_lon, sessionAdmin, dest_name) VALUES($1, $2, $3, $4)', [lat, lon, userId, name]);
    if (result.rowCount > 0) res.json({ message: 'Session created successfully!' });
    else res.json({ message: 'Error creating session!' });
  } catch (err) {
    res.status(500).json('Database query failed!');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
