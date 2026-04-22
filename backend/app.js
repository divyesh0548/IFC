const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

// Load environment variables first
dotenv.config();

const { runReminderEmails } = require('./scripts/reminder_emails');
const { runBootstrap } = require('./config/bootstrap');
require('./utils/db'); // Load shared pool (timezone set there)

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration to allow credentials
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173'); // Vite default port
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware (large limit for client-parsed Excel row payloads)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging middleware (after body parsing so req.body is available)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  
  if (req.body && Object.keys(req.body).length > 0 && !req.path.includes('/bulk-import-rows')) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  if (Object.keys(req.query).length > 0) {
    console.log('Query:', req.query);
  }
  
  // Log response status when it finishes
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`[${timestamp}] ${req.method} ${req.path} - Status: ${res.statusCode}`);
    return originalSend.call(this, data);
  };
  
  next();
});


app.use('/api', require('./routes'));
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});


// Reminder emails for control_forms (runs every 1 minute)
console.log('Starting reminder emails scheduler (runs every 1 minute)...');
setInterval(async () => {
  try {
    await runReminderEmails();
  } catch (error) {
    console.error('Error in reminder emails job:', error);
  }
}, 60 * 1000);

// Run bootstrap tasks, then start server
(async () => {
  try {
    await runBootstrap();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server bootstrap failed. Exiting process.', error);
    process.exit(1);
  }
})();

