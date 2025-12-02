const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { exec } = require('child_process');
const { Pool } = require('pg');
const crypto = require('crypto');

require('dotenv').config();
const app = express();
const PORT = 3001;

// Use strong secret for production, fallback for development
// const JWT_SECRET = crypto.randomBytes(64).toString('hex');

// Quick setup for development - replace with strong secret later
const JWT_SECRET = process.env.JWT;

const pool = new Pool({
  connectionString: process.env.API_NEON,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

app.use(cors());
app.use(express.json());

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const query = `SELECT id, username, password_hash, role FROM users WHERE username = '${username}'`;
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Verify password using PostgreSQL crypt function
    const passwordQuery = `SELECT (password_hash = crypt('${password}', password_hash)) as password_match FROM users WHERE username = '${username}'`;
    const passwordResult = await pool.query(passwordQuery);
    
    if (!passwordResult.rows[0]?.password_match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      }, 
      JWT_SECRET,
      { algorithm: 'HS256' } // TODO: Add expiration in production
      //{ algorithm: 'HS256', expiresIn: '1h' }
    );
    
    res.json({ 
      message: 'Login successful', 
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
    
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {algorithms: ['HS256']});
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error.message });
  }
};

// Network connectivity testing endpoint
app.post('/api/ping', verifyToken, (req, res) => {
  const { host } = req.body;
  
  if (!host) {
    return res.status(400).json({ message: 'Host parameter required' });
  }
  
  // Simple ping implementation for network diagnostics
  // Cross-platform ping command
  const isWindows = process.platform === 'win32';
  const command = isWindows ? `ping -n 4 ${host}` : `ping -c 4 ${host}`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      res.json({
        success: false,
        error: error.message,
        output: stderr
      });
    } else {
      res.json({
        success: true,
        output: stdout
      });
    }
  });
});

// System information and diagnostics endpoint
app.post('/api/system-info', verifyToken, (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ message: 'Command parameter required' });
  }
  
  // Execute system diagnostic commands for troubleshooting
  exec(command, (error, stdout, stderr) => {
    res.json({
      command: command,
      output: stdout,
      error: stderr,
      success: !error
    });
  });
});

// Endpoint untuk mendapatkan profile user
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Admin endpoint for user management
app.get('/api/admin/users', verifyToken, async (req, res) => {
  // Check admin privileges
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  try {
    const result = await pool.query('SELECT id, username, role FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'CorporateNet API Server',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      'POST /api/login': 'User authentication',
      'GET /api/profile': 'Get user profile',
      'GET /api/admin/users': 'Get all users (admin only)',
      'POST /api/ping': 'Network connectivity test',
      'POST /api/system-info': 'System information retrieval'
    }
  });
});

app.listen(PORT, () => {
  console.log(`CorporateNet API Server running on port ${PORT}`);
  console.log('Server status: Online');
  console.log('Environment: Development');
});