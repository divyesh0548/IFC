const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

// Load environment variables first
dotenv.config();

const authRoutes = require('./routes/auth');
const companiesRoutes = require('./routes/companies');
const companyCoRoutes = require('./routes/company_co');
const controlFormsRoutes = require('./routes/control_forms');
const approverRoutes = require('./routes/approver');
const { processExcelFiles } = require('./scripts/process_excel_files');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration to allow credentials
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173'); // Vite default port
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging middleware (after body parsing so req.body is available)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  
  if (req.body && Object.keys(req.body).length > 0) {
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/company-co', companyCoRoutes);
app.use('/api/control-forms', controlFormsRoutes);
app.use('/api/approver', approverRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start scheduled task to process Excel files every 1 minute
console.log('Starting Excel file processor scheduler (runs every 1 minute)...');
setInterval(async () => {
  try {
    await processExcelFiles();
  } catch (error) {
    console.error('Error in scheduled Excel file processing:', error);
  }
}, 60 * 1000); // 60 seconds = 1 minute

// Process any existing unprocessed files on server start
processExcelFiles().catch(error => {
  console.error('Error processing Excel files on startup:', error);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

