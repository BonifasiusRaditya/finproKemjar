const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = 3001;

// VULNERABILITY 1: Weak JWT Secret
const JWT_SECRET = 'secret'; // Sangat lemah dan mudah ditebak

app.use(cors());
app.use(express.json());

// Database palsu untuk demo
const users = [
  {
    id: 1,
    username: 'admin',
    password: '$2b$10$rOq3.5Z9t6X8QGQ3Z8X8Q.8X8Q3Z8X8Q3Z8X8Q3Z8X8Q3Z8X8Q3Z8Q', // password: admin123
    role: 'admin'
  },
  {
    id: 2,
    username: 'user',
    password: '$2b$10$8X8Q3Z8X8Q3Z8X8Q3Z8X8Q.8X8Q3Z8X8Q3Z8X8Q3Z8X8Q3Z8X8Q3Z8X', // password: user123
    role: 'user'
  }
];

// Endpoint login dengan JWT lemah
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  // Untuk demo, kita akan menerima password sederhana
  if (username === 'admin' && password === 'admin123') {
    // VULNERABILITY: JWT tanpa expiration dan secret lemah
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      }, 
      JWT_SECRET // Secret yang sangat lemah
      // Tidak ada expiration time
    );
    
    res.json({ 
      message: 'Login successful', 
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } else if (username === 'user' && password === 'user123') {
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
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Middleware untuk verifikasi token (dengan kerentanan)
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    // VULNERABILITY: Tidak ada algoritma verification yang proper
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256', 'none'] });
    req.user = decoded;
    next();
  } catch (error) {
    // VULNERABILITY: Error handling yang buruk, bisa expose information
    res.status(401).json({ message: 'Invalid token', error: error.message });
  }
};

// VULNERABILITY 2: Command Injection
app.post('/api/ping', verifyToken, (req, res) => {
  const { host } = req.body;
  
  if (!host) {
    return res.status(400).json({ message: 'Host parameter required' });
  }
  
  // VULNERABILITY: Command injection - tidak ada sanitasi input
  const command = `ping -c 4 ${host}`;
  
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

// VULNERABILITY 3: Command Injection pada sistem info
app.post('/api/system-info', verifyToken, (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ message: 'Command parameter required' });
  }
  
  // VULNERABILITY: Langsung eksekusi command tanpa validasi
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
app.get('/api/profile', verifyToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  res.json({
    id: user.id,
    username: user.username,
    role: user.role
  });
});

// Endpoint admin only (dengan JWT verification yang lemah)
app.get('/api/admin/users', verifyToken, (req, res) => {
  // VULNERABILITY: Tidak ada proper role checking
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  res.json(users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role
  })));
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