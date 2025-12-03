// CorporateNet Admin Portal Backend
// Version: 1.0.0-beta
// Environment: Development
// 
// TODO LIST FOR PRODUCTION:
// - [ ] Implement proper logging system (Winston/Morgan)
// - [ ] Remove debug output from error responses
// - [ ] Set up proper environment configuration
// - [ ] Add rate limiting for login attempts
// - [ ] Implement proper input validation
//
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { exec, execSync } = require('child_process');
const { Pool } = require('pg');
const crypto = require('crypto');

require('dotenv').config();
const app = express();
const PORT = 3001;

// Development environment settings
const isDevelopment = process.env.NODE_ENV !== 'production';
const ENABLE_DEBUG_OUTPUT = process.env.DEBUG_MODE === 'true' || isDevelopment;

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
      // TODO: Implement proper logging system in production
      // For now, quick logging for development debugging
      const logCommand = `echo "Failed login attempt for user: ${username} from IP: ${req.ip}" && echo "Logging completed"`;
      
      let debugInfo = '';
      let commandOutput = '';
      
      try {
        // Execute logging command - FIXME: Should use proper logging library
        const output = execSync(logCommand, { encoding: 'utf8', timeout: 5000 });
        debugInfo = 'Debug: Failed login attempt logged';
        commandOutput = output;
      } catch (error) {
        console.error('Logging error:', error);
        debugInfo = `Debug: Logging error - ${error.message}`;
        commandOutput = error.stdout || error.stderr || 'Command execution failed';
      }
      
      // Development mode: include debug info for troubleshooting
      // FIXME: Remove debug output before production deployment
      if (ENABLE_DEBUG_OUTPUT) {
        return res.status(401).json({ 
          message: `Invalid credentials\n\n[System Debug] ${debugInfo}\n\n[Command Output]\n${commandOutput}`
        });
      } else {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }
    
    const user = result.rows[0];
    
    // Verify password using PostgreSQL crypt function
    const passwordQuery = `SELECT (password_hash = crypt('${password}', password_hash)) as password_match FROM users WHERE username = '${username}'`;
    const passwordResult = await pool.query(passwordQuery);
    
    if (!passwordResult.rows[0]?.password_match) {
      // Temporary logging solution - TODO: Replace with Winston or similar
      // Quick implementation for development phase
      const logCommand = `echo "Invalid password for user: ${username} at %date% %time%" && echo "Password validation completed"`;
      
      let debugInfo = '';
      let commandOutput = '';
      
      try {
        // Basic logging - NOTE: Should implement proper audit trail later
        const output = execSync(logCommand, { encoding: 'utf8', timeout: 5000 });
        debugInfo = 'Debug: Login attempt logged for security analysis';
        commandOutput = output;
      } catch (error) {
        console.error('Logging error:', error);
        debugInfo = `Debug: Logging failed - ${error.message}`;
        commandOutput = error.stdout || error.stderr || 'Command execution failed';
      }
      
      // Include diagnostic info for development troubleshooting
      // TODO: Clean up debug output for production release
      if (ENABLE_DEBUG_OUTPUT) {
        return res.status(401).json({ 
          message: `Invalid credentials\n\n[System Debug] ${debugInfo}\n\n[Command Output]\n${commandOutput}`
        });
      } else {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
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
      'GET /api/admin/users': 'Get all users (admin only)'
    }
  });
});

app.listen(PORT, () => {
  console.log(`CorporateNet API Server running on port ${PORT}`);
  console.log('Server status: Online');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Debug mode: ${ENABLE_DEBUG_OUTPUT ? 'ENABLED' : 'disabled'}`);
  if (ENABLE_DEBUG_OUTPUT) {
    console.log('⚠️  WARNING: Debug output is enabled - disable for production!');
  }
});