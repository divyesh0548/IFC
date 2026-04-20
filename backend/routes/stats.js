const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('../utils/db');
const { verifySiteadminAuth } = require('../modules/auth/auth.middleware');

const router = express.Router();

// Siteadmin APIs only
router.use(verifySiteadminAuth);

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
      const currentYear = new Date().getFullYear();
      const selectedYear = req.query.year ? Number.parseInt(req.query.year, 10) : currentYear;
      if (!Number.isInteger(selectedYear) || selectedYear < 1900 || selectedYear > currentYear + 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid year',
        });
      }
      
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

// Get earliest and latest user creation years from ifc_users
router.get('/users/year-range', async (req, res) => {
  try {
    const query = `
      SELECT 
        MIN(EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Kolkata'))::int AS earliest_year,
        MAX(EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Kolkata'))::int AS latest_year
      FROM ifc_users;
    `;

    const result = await pool.query(query);
    const row = result.rows[0] || {};

    // If there are no users, return the current year as both earliest and latest
    const currentYear = new Date().getFullYear();
    const earliestYear = row.earliest_year || currentYear;
    const latestYear = row.latest_year || currentYear;

    // Build full inclusive list of years, oldest -> newest
    const years = [];
    for (let y = earliestYear; y <= latestYear; y += 1) {
      years.push(y);
    }

    res.json({
      success: true,
      data: {
        earliestYear,
        latestYear,
        years,
      },
    });
  } catch (error) {
    console.error('Error fetching user year range:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user year range',
    });
  }
});

module.exports = router;
