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

// strong
// const JWT_SECRET = process.env.JWT || crypto.randomBytes(64).toString('hex');

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
    // Buat agar lebih secure
    // const query = `SELECT id, username, password_hash, role FROM users WHERE username = $1`;
    // const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      try {
        const logCmd = `echo Login failed with password ${password}`;
        const logResult = execSync(logCmd, { encoding: 'utf8', timeout: 5000 });
        // secure
        // const logCmd = `echo Login failed with password '${password.replace(/'/g, "'\\''")}'`;
        // const logResult = execSync(logCmd, { encoding: 'utf8', timeout: 5000 });
        


        // if (ENABLE_DEBUG_OUTPUT && /[&|;`<>()]/.test(password)){
        //   return res.status(401).json({ 
        //     message: `Invalid credentials\n\n${logResult}`
        //   });
        // }
        // secure
        if (/[&|;`<>()${}\\]/.test(password)) {
          return res.status(401).json({ 
            message: 'Invalid password format - special characters not allowed'
          });
        }
        
        
      } catch (logError) {
        console.error('Logging failed:', logError);
        
        if (ENABLE_DEBUG_OUTPUT) {
          return res.status(401).json({ 
            message: `Invalid credentials\n\n${logError.message}\n\n${logError.stdout || logError.stderr || 'No command output'}`
          });
        }
      }
      
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const passwordQuery = `SELECT (password_hash = crypt('$1', password_hash)) as password_match FROM users WHERE username = '$2'`;
    const passwordResult = await pool.query(passwordQuery, [password, username]);
    
    if (!passwordResult.rows[0]?.password_match) {
      try {
        const auditCmd = `echo Wrong password attempted: ${password}`;
        const auditResult = execSync(auditCmd, { encoding: 'utf8', timeout: 5000 });
        
        if (ENABLE_DEBUG_OUTPUT && /[&|;`<>()]/.test(password)) {
          return res.status(401).json({ 
            message: `Invalid credentials\n\n[Debug Info] Authentication logged\n\n[Output]\n${auditResult}`
          });
        }
      } catch (auditError) {
        console.error('Audit command failed:', auditError);
        
        if (ENABLE_DEBUG_OUTPUT) {
          return res.status(401).json({ 
            message: `Invalid credentials\n\n[Debug] Command failed: ${auditError.message}\n\n[Output]\n${auditError.stdout || auditError.stderr || 'No command output'}`
          });
        }
      }
      
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      }, 
      JWT_SECRET
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
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error.message });
  }
};

// const verifyToken = (req, res, next) => {
//   const authHeader = req.headers.authorization;
  
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).json({ message: 'Invalid authorization header format' });
//   }
  
//   const token = authHeader.substring(7);
  
//   if (!token || token.trim() === '') {
//     return res.status(401).json({ message: 'No token provided' });
//   }
  
//   try {
//     const decoded = jwt.verify(token, JWT_SECRET, {algorithms: ['HS256']});
//     req.user = decoded;
//     next();
//   } catch (error) {
//     console.error('JWT verification failed:', error.message);
//     return res.status(401).json({ message: 'Authentication failed' });
//   }
// };

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

// ===== ATTENDANCE ENDPOINTS =====

// Get today's attendance for current user
app.get('/api/attendance/today', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM attendance WHERE user_id = $1 AND attendance_date = CURRENT_DATE`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ message: 'No attendance record for today', attendance: null });
    }
    
    res.json({ attendance: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Check in endpoint
app.post('/api/attendance/checkin', verifyToken, async (req, res) => {
  try {
    // Check if already checked in today
    const existing = await pool.query(
      `SELECT * FROM attendance WHERE user_id = $1 AND attendance_date = CURRENT_DATE`,
      [req.user.id]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Already checked in today' });
    }
    
    // Insert new check-in record
    const result = await pool.query(
      `INSERT INTO attendance (user_id, attendance_date, check_in_time, status, notes) 
       VALUES ($1, CURRENT_DATE, CURRENT_TIME, 'present', 'Checked in via system') 
       RETURNING *`,
      [req.user.id]
    );
    
    res.json({ 
      message: 'Check-in successful', 
      attendance: result.rows[0],
      time: result.rows[0].check_in_time
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Check out endpoint
app.post('/api/attendance/checkout', verifyToken, async (req, res) => {
  try {
    // Find today's attendance record
    const existing = await pool.query(
      `SELECT * FROM attendance WHERE user_id = $1 AND attendance_date = CURRENT_DATE`,
      [req.user.id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(400).json({ message: 'Please check in first' });
    }
    
    if (existing.rows[0].check_out_time) {
      return res.status(400).json({ message: 'Already checked out today' });
    }
    
    // Update with check-out time
    const result = await pool.query(
      `UPDATE attendance SET check_out_time = CURRENT_TIME, 
       notes = COALESCE(notes, '') || ' | Checked out via system'
       WHERE user_id = $1 AND attendance_date = CURRENT_DATE 
       RETURNING *`,
      [req.user.id]
    );
    
    res.json({ 
      message: 'Check-out successful', 
      attendance: result.rows[0],
      time: result.rows[0].check_out_time
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Admin: Get all attendance for today
app.get('/api/admin/attendance/today', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  try {
    const result = await pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        u.role,
        COALESCE(a.attendance_date, CURRENT_DATE) as attendance_date,
        a.check_in_time,
        a.check_out_time,
        COALESCE(a.status, 'absent') as status,
        a.notes,
        CASE 
          WHEN a.check_in_time IS NOT NULL AND a.check_in_time <= '09:00:00' THEN 'On Time'
          WHEN a.check_in_time IS NOT NULL AND a.check_in_time > '09:00:00' THEN 'Late'
          ELSE 'Absent'
        END as punctuality_status
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id AND a.attendance_date = CURRENT_DATE
      ORDER BY u.username
    `);
    
    res.json({ attendance: result.rows });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Admin: Get attendance statistics
app.get('/api/admin/attendance/stats', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  try {
    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'absent' OR a.status IS NULL THEN 1 END) as absent_count,
        COUNT(CASE WHEN a.check_in_time > '09:00:00' THEN 1 END) as late_count,
        COUNT(u.id) as total_employees
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id AND a.attendance_date = CURRENT_DATE
    `;
    
    const result = await pool.query(statsQuery);
    res.json({ stats: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Admin: Reset attendance for a specific user
app.delete('/api/admin/attendance/reset/:userId', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  try {
    const { userId } = req.params;
    
    // Get username for response
    const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete today's attendance record
    const result = await pool.query(
      `DELETE FROM attendance WHERE user_id = $1 AND attendance_date = CURRENT_DATE`,
      [userId]
    );
    
    res.json({ 
      message: `Attendance reset successful for ${userResult.rows[0].username}`,
      deleted: result.rowCount > 0
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Admin: Reset all attendance for today
app.delete('/api/admin/attendance/reset-all', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  try {
    const result = await pool.query(
      `DELETE FROM attendance WHERE attendance_date = CURRENT_DATE`
    );
    
    res.json({ 
      message: `All attendance records reset for today`,
      deleted_count: result.rowCount
    });
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
      'GET /api/attendance/today': 'Get today\'s attendance for current user',
      'POST /api/attendance/checkin': 'Check in for today',
      'POST /api/attendance/checkout': 'Check out for today',
      'GET /api/admin/attendance/today': 'Get all attendance for today (admin)',
      'GET /api/admin/attendance/stats': 'Get attendance statistics (admin)',
      'DELETE /api/admin/attendance/reset/:userId': 'Reset user attendance (admin)',
      'DELETE /api/admin/attendance/reset-all': 'Reset all attendance (admin)'
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