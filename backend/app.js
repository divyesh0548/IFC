const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Load environment variables first
dotenv.config();

const { runReminderEmails } = require('./scripts/reminder_emails/reminder_emails');
const { runApproverReminderEmails } = require('./scripts/reminder_emails/approver_reminder_emails');
const { runIneffectiveReminderEmails } = require('./scripts/reminder_emails/ineffective_reminder_emails');
const { runDeficiencyReviewReminderEmails } = require('./scripts/reminder_emails/deficiency_review_reminder_emails');
const { runPendingLoginEmails } = require('./scripts/login_email_sender');
const { runPendingRacmActiveUserEmails } = require('./scripts/racm_active_user_email_sender');
const { runPendingRacmInactiveUserEmails } = require('./scripts/racm_inactive_user_email_sender');
const { runPendingUserQueryEmails } = require('./scripts/user_query_email_sender');
const { runBootstrap } = require('./config/bootstrap');
const {
  checkDatabaseConnectivity,
  formatDbConnectionError,
  isPgConnectionError,
} = require('./utils/db');

function logScheduledJobError(jobName, error) {
  if (isPgConnectionError(error)) {
    console.warn(`[${jobName}] skipped: ${formatDbConnectionError(error)}`);
    return;
  }
  console.error(`Error in ${jobName}:`, error);
}

const app = express();
const PORT = process.env.PORT || 3000;

function buildAllowedOrigins() {
  const configuredOrigins = [
    process.env.VITE_FRONTEND_URL,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return new Set([
    ...configuredOrigins,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ]);
}

const allowedOrigins = buildAllowedOrigins();

// CORS configuration to allow credentials
// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', 'http://localhost:5173'); // Vite default port
//   res.header('Access-Control-Allow-Credentials', 'true');
//   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
//   if (req.method === 'OPTIONS') {
//     return res.sendStatus(200);
//   }
//   next();
// });

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = String(origin).replace(/\/+$/, '');
    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
}));

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

const path = require('path');

// Then static files
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Then catch-all for React
// app.get(/.*/, (req, res) => {
//   res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
// });


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});


function startScheduledJobs() {
  console.log('Starting reminder emails scheduler (runs every 1 minute)...');
  setInterval(async () => {
    try {
      await runReminderEmails();
    } catch (error) {
      logScheduledJobError('reminder emails job', error);
    }
  }, 60 * 1000);

  console.log('Starting approver reminder emails scheduler (runs every 1 minute)...');
  setInterval(async () => {
    try {
      await runApproverReminderEmails();
    } catch (error) {
      logScheduledJobError('approver reminder emails job', error);
    }
  }, 60 * 1000);

  console.log('Starting ineffective RACM reminder emails scheduler (runs every 1 minute)...');
  setInterval(async () => {
    try {
      await runIneffectiveReminderEmails();
    } catch (error) {
      logScheduledJobError('ineffective reminder emails job', error);
    }
  }, 60 * 1000);

  console.log('Starting deficiency review reminder emails scheduler (runs every 1 minute)...');
  setInterval(async () => {
    try {
      await runDeficiencyReviewReminderEmails();
    } catch (error) {
      logScheduledJobError('deficiency review reminder emails job', error);
    }
  }, 60 * 1000);

  console.log('Starting login email scheduler (runs every 1 minute)...');
  setInterval(async () => {
    try {
      await runPendingLoginEmails();
    } catch (error) {
      logScheduledJobError('login email job', error);
    }
  }, 60 * 1000);

  console.log('Starting active RACM user email scheduler (runs every 1 minute)...');
  setInterval(async () => {
    try {
      await runPendingRacmActiveUserEmails();
    } catch (error) {
      logScheduledJobError('active RACM user email job', error);
    }
  }, 60 * 1000);

  console.log('Starting inactive RACM user email scheduler (runs every 1 minute)...');
  setInterval(async () => {
    try {
      await runPendingRacmInactiveUserEmails();
    } catch (error) {
      logScheduledJobError('inactive RACM user email job', error);
    }
  }, 60 * 1000);

  console.log('Starting user query email scheduler (runs every 1 minute)...');
  setInterval(async () => {
    try {
      await runPendingUserQueryEmails();
    } catch (error) {
      logScheduledJobError('user query email job', error);
    }
  }, 60 * 1000);
}

// Probe DB, run bootstrap, then start HTTP + schedulers.
(async () => {
  const connectivity = await checkDatabaseConnectivity();
  if (connectivity.ok) {
    console.log(`[db] ${connectivity.message}`);
  } else {
    console.warn(`[db] ${connectivity.message}`);
  }

  try {
    await runBootstrap();
  } catch (error) {
    console.error('Server bootstrap failed. Starting anyway.', error);
  }

  startScheduledJobs();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
})();

