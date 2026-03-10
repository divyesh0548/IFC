const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();

// Database connection pool
const dbHost = process.env.DB_HOST || 'localhost';
const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1';

const pool = new Pool({
  user: process.env.DB_USER || 'divyesh',
  host: dbHost,
  database: process.env.DB_NAME || 'ifc_dev',
  password: String(process.env.DB_PASSWORD || '0548'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  // Enable SSL for remote connections (AWS RDS requires SSL)
  ssl: isLocalhost ? false : {
    rejectUnauthorized: false
  }
});

// Set timezone to IST for all connections
pool.on('connect', async (client) => {
  await client.query("SET timezone = 'Asia/Kolkata'");
});

// Stats endpoint - Get counts of companies and users (defined before other routes)
router.get('/', async (req, res) => {
    try {
      console.log('Fetching stats...');
      
      // Get company count
      const companiesResult = await pool.query('SELECT COUNT(*) as count FROM companies');
      const companyCount = parseInt(companiesResult.rows[0].count, 10);
      console.log('Company count:', companyCount);
  
      // Get user count
      const usersResult = await pool.query('SELECT COUNT(*) as count FROM ifc_users');
      const userCount = parseInt(usersResult.rows[0].count, 10);
      console.log('User count:', userCount);
  
      const responseData = {
        success: true,
        data: {
          companies: companyCount,
          users: userCount
        }
      };
      
      console.log('Sending stats response:', responseData);
      res.status(200).json(responseData);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching statistics',
        error: error.message
      });
    }
  });


router.get('/users/monthly-stats', async (req, res) => {
    try {
      const selectedYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    //   const selectedYear = 2026;
      
      const query = `
      SELECT 
        EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata')::int as month_num,
        COUNT(*) as user_count
      FROM ifc_users 
      WHERE EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Kolkata') = $1
      GROUP BY EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata')::int
      ORDER BY month_num
    `;
  
      const result = await pool.query(query, [selectedYear]);
      
      // Initialize 12 months with zeros
      const monthsData = Array(12).fill(0);
      
      result.rows.forEach(row => {
        monthsData[row.month_num - 1] = parseInt(row.user_count);
      });
  
      res.json({
        success: true,
        data: {
          year: selectedYear,
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          series: [{
            name: 'New Users',
            data: monthsData
          }],
          totalUsers: monthsData.reduce((sum, count) => sum + count, 0)
        }
      });
    } catch (error) {
      console.error('Error fetching monthly users:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch monthly user stats' });
    }
  });
  

router.get('/companies/user-distribution', async (req, res) => {
    try {
      const query = `
        SELECT 
          c.company_name,
          COUNT(u.id) as user_count
        FROM companies c
        LEFT JOIN ifc_users u ON c.company_identifier = u.company_identifier
        GROUP BY c.company_identifier, c.company_name
        HAVING COUNT(u.id) > 0
        ORDER BY user_count DESC
      `;
  
      const result = await pool.query(query);
      
      // Transform for PieChart
      const pieData = result.rows.map(row => ({
        value: parseInt(row.user_count),
        label: row.company_name
      }));
  
      res.json({
        success: true,
        data: {
          pieData: pieData,
          totalCompanies: pieData.length,
          totalUsers: pieData.reduce((sum, item) => sum + item.value, 0)
        }
      });
    } catch (error) {
      console.error('Error fetching company user distribution:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch company user stats'
      });
    }
  });
  
  
  


module.exports = router;

