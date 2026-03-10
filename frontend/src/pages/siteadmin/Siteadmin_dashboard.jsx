import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import { useMediaQuery } from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { Select, MenuItem, FormControl, InputLabel, Box, Grid, Card, CardHeader, CardContent, Stack, Typography } from '@mui/material';

function Siteadmin_Dashboard() {
    const theme = useTheme()
    const navigate = useNavigate()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
    const isTablet = useMediaQuery(theme.breakpoints.down('md'))
    const [companies, setCompanies] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [pieData, setPieData] = useState([]);
    const [monthlyData, setMonthlyData] = useState([])
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    
    const barChartHeight = isMobile ? 350 : isTablet ? 420 : 450
    const pieChartSize = isMobile ? 280 : isTablet ? 320 : 360
    const pieInnerRadius = isMobile ? 40 : isTablet ? 50 : 60
    const pieOuterRadius = isMobile ? 120 : isTablet ? 140 : 160

    const fetchMonthlyData = async (year) => {
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:3000/api/stats/users/monthly-stats?year=${year}`);
            const result = await response.json();

            if (result.success) {
                setMonthlyData(result.data.series[0].data);
            }
        } catch (error) {
            console.error('Error fetching chart data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCompanyUserData = async () => {
        try {
            const response = await fetch(
                'http://localhost:3000/api/stats/companies/user-distribution'
            );
            const result = await response.json();

            if (result.success) {
                setPieData(result.data.pieData);
            }
        } catch (error) {
            console.error('Error fetching pie data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies()
        console.log(selectedYear);
        fetchMonthlyData(selectedYear);
        fetchCompanyUserData();
    }, [selectedYear])

    const years = Array.from({ length: 5 }, (_, i) =>
        new Date().getFullYear() - i
    ); // 2026, 2025, 2024, 2023, 2022

    const fetchCompanies = async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch('http://localhost:3000/api/companies', {
                method: 'GET',
                credentials: 'include',
            })

            const data = await response.json()

            if (response.ok && data.success) {
                setCompanies(data.data || [])
            } else {
                setError(data.message || 'Failed to fetch companies')
            }
        } catch (err) {
            console.error('Error fetching companies:', err)
            setError('Error fetching companies')
        } finally {
            setLoading(false)
        }
    }

    function SVGStar({ className, color }) {
        return (
            <svg viewBox="-7.423 -7.423 14.846 14.846">
                <path
                    className={className}
                    d="M0,-7.528L1.69,-2.326L7.16,-2.326L2.735,0.889L4.425,6.09L0,2.875L-4.425,6.09L-2.735,0.889L-7.16,-2.326L-1.69,-2.326Z"
                    fill={color}
                />
            </svg>
        );
    }


    return (
        <Box sx={{ 
            width: '100%', 
            minHeight: '100vh',
            py: 0,
            paddingRight: 2,
            bgcolor: theme => theme.palette.mode === 'dark' 
                ? 'background.default' 
                : 'grey.50'
        }}>
            <Box sx={{ 
                maxWidth: '100%', 
                mx: 'auto',
                width: '100%'
            }}>
                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', lg: 'row' },
                    gap: 3,
                    width: '100%',
                    alignItems: 'stretch'
                }}>
                    {/* User Count Bar Chart */}
                    <Box sx={{ width: { xs: '100%', lg: '70%' }, flexShrink: 0 }}>
                        <Card
                            variant="outlined"
                            sx={{
                                height: '100%',
                                minHeight: 550,
                                borderRadius: 3,
                                p: { xs: 2, sm: 3 },
                                boxShadow: theme => theme.palette.mode === 'dark'
                                    ? '0 8px 32px rgba(0,0,0,0.3)'
                                    : '0 4px 20px rgba(0,0,0,0.08)',
                                border: theme => theme.palette.mode === 'dark'
                                    ? '1px solid rgba(255,255,255,0.1)'
                                    : '1px solid rgba(0,0,0,0.08)',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    boxShadow: theme => theme.palette.mode === 'dark'
                                        ? '0 12px 40px rgba(0,0,0,0.4)'
                                        : '0 8px 28px rgba(0,0,0,0.12)',
                                }
                            }}
                        >
                            <CardHeader
                                title={
                                    <Typography 
                                        variant="h5" 
                                        sx={{ 
                                            fontWeight: 700, 
                                            mb: 0.5,
                                            fontSize: { xs: '1.25rem', sm: '1.5rem' }
                                        }}
                                    >
                                        New Users per Month
                                    </Typography>
                                }
                                subheader={
                                    <Typography 
                                        variant="body2" 
                                        color="text.secondary"
                                        sx={{ mt: 0.5 }}
                                    >
                                        Monthly user registrations across all companies
                                    </Typography>
                                }
                                sx={{ 
                                    pb: 2,
                                    px: 0
                                }}
                            />
                            <CardContent sx={{ 
                                pt: 1, 
                                pb: 2, 
                                px: 0,
                                '&:last-child': { pb: 2 } 
                            }}>
                                <Stack 
                                    direction="row" 
                                    alignItems="center" 
                                    spacing={2} 
                                    mb={3}
                                    sx={{ px: { xs: 0, sm: 1 } }}
                                >
                                    <FormControl 
                                        size="small" 
                                        sx={{ 
                                            minWidth: 120,
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 2
                                            }
                                        }}
                                    >
                                        <InputLabel>Year</InputLabel>
                                        <Select
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(e.target.value)}
                                            label="Year"
                                        >
                                            {years.map(year => (
                                                <MenuItem key={year} value={year}>{year}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Stack>

                                <Box sx={{ 
                                    height: barChartHeight, 
                                    width: '100%',
                                    minWidth: 0
                                }}>
                                    <BarChart
                                        xAxis={[{
                                            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                                            scaleType: 'band'
                                        }]}
                                        series={[{ 
                                            data: monthlyData, 
                                            label: 'New Users',
                                            color: theme.palette.mode === 'dark' ? '#90caf9' : '#1976d2'
                                        }]}
                                        height={barChartHeight}
                                        width={undefined}
                                        sx={{ width: '100%' }}
                                    />
                                </Box>
                            </CardContent>
                        </Card>
                    </Box>

                    {/* User Distribution Pie Chart */}
                    <Box sx={{ width: { xs: '100%', lg: '30%' }, flexShrink: 0 }}>
                        <Card
                            variant="outlined"
                            sx={{
                                height: '100%',
                                minHeight: 550,
                                borderRadius: 3,
                                p: { xs: 2, sm: 3 },
                                boxShadow: theme => theme.palette.mode === 'dark'
                                    ? '0 8px 32px rgba(0,0,0,0.3)'
                                    : '0 4px 20px rgba(0,0,0,0.08)',
                                border: theme => theme.palette.mode === 'dark'
                                    ? '1px solid rgba(255,255,255,0.1)'
                                    : '1px solid rgba(0,0,0,0.08)',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    boxShadow: theme => theme.palette.mode === 'dark'
                                        ? '0 12px 40px rgba(0,0,0,0.4)'
                                        : '0 8px 28px rgba(0,0,0,0.12)',
                                }
                            }}
                        >
                            <CardHeader
                                title={
                                    <Typography 
                                        variant="h5" 
                                        sx={{ 
                                            fontWeight: 700, 
                                            mb: 0.5,
                                            fontSize: { xs: '1.25rem', sm: '1.5rem' }
                                        }}
                                    >
                                         Users by Company
                                    </Typography>
                                }
                                subheader={
                                    <Typography 
                                        variant="body2" 
                                        color="text.secondary"
                                        sx={{ mt: 0.5 }}
                                    >
                                        {pieData.reduce((sum, d) => sum + d.value, 0)} total users across {pieData.length} companies
                                    </Typography>
                                }
                                sx={{ 
                                    pb: 2,
                                    px: 0
                                }}
                            />
                            <CardContent sx={{ 
                                pt: 1, 
                                pb: 2, 
                                textAlign: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 400
                            }}>
                                <Box sx={{
                                    height: pieChartSize,
                                    width: pieChartSize,
                                    maxWidth: '100%',
                                    mx: 'auto',
                                    position: 'relative',
                                    mt: 1
                                }}>
                                    <PieChart
                                        loading={loading}
                                        series={[
                                            {
                                                data: pieData,
                                                innerRadius: pieInnerRadius,
                                                outerRadius: pieOuterRadius,
                                            },
                                        ]}
                                        width={pieChartSize}
                                        height={pieChartSize}
                                        slotProps={{
                                            legend: {
                                                direction: 'column',
                                                position: { vertical: 'bottom', horizontal: 'middle' },
                                                padding: isMobile ? 0.5 : 1,
                                                itemMarkWidth: 12,
                                                itemMarkHeight: 12,
                                                markGap: 8,
                                                itemGap: 6,
                                            },
                                        }}
                                    />
                                </Box>
                            </CardContent>
                        </Card>
                    </Box>
                </Box>
            </Box>
        </Box>
    )
}

export default Siteadmin_Dashboard