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
    const [years, setYears] = useState([new Date().getFullYear()]);
    
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

    // Load year range for user stats from backend
    useEffect(() => {
        const fetchYearRange = async () => {
            try {
                const response = await fetch('http://localhost:3000/api/stats/users/year-range');
                const result = await response.json();

                if (response.ok && result.success && result.data && Array.isArray(result.data.years) && result.data.years.length > 0) {
                    setYears(result.data.years);

                    // If current selected year is outside the range, clamp to latestYear
                    const { earliestYear, latestYear } = result.data;
                    if (selectedYear < earliestYear || selectedYear > latestYear) {
                        setSelectedYear(latestYear);
                    }
                } else {
                    // Fallback to last 5 years if API returns no data
                    const currentYear = new Date().getFullYear();
                    setYears(Array.from({ length: 5 }, (_, i) => currentYear - i).reverse());
                }
            } catch (err) {
                console.error('Error fetching user year range:', err);
                const currentYear = new Date().getFullYear();
                setYears(Array.from({ length: 5 }, (_, i) => currentYear - i).reverse());
            }
        };

        fetchYearRange();
    }, []);

    useEffect(() => {
        fetchCompanies()
        fetchMonthlyData(selectedYear);
        fetchCompanyUserData();
    }, [selectedYear])

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
                {/* Quick Navigation Tiles */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', lg: 'row' },
                        gap: 2.5,
                        mb: 3,
                    }}
                >
                    <Box sx={{ width: { xs: '100%', lg: '50%' }, flexShrink: 0 }}>
                        <Card
                            variant="outlined"
                            sx={{
                                flex: 1,
                                borderRadius: 2,
                                px: 2,
                                py: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                backgroundColor: theme => theme.palette.background.paper,
                                borderColor: theme => theme.palette.divider,
                                boxShadow: 'none',
                                transition: 'background-color 0.15s ease, border-color 0.15s ease',
                                '&:hover': {
                                    backgroundColor: theme => theme.palette.action.hover,
                                    borderColor: theme => theme.palette.text.disabled,
                                },
                            }}
                            onClick={() => navigate('/siteadmin/company-management')}
                        >
                        <Box>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.14em',
                                    fontSize: '0.72rem',
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(226,232,240,0.9)'
                                        : 'rgba(30,64,175,0.9)',
                                    mb: 0.5,
                                }}
                            >
                                Administration
                            </Typography>
                            <Typography
                                variant="h5"
                                sx={{
                                    fontWeight: 800,
                                    color: theme => theme.palette.mode === 'dark'
                                        ? '#e5f2ff'
                                        : '#0f172a',
                                    letterSpacing: 0.2,
                                    fontSize: { xs: '1.18rem', sm: '1.36rem', md: '1.45rem' },
                                }}
                            >
                                Company Management
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    mt: 0.75,
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(226,232,240,0.85)'
                                        : 'rgba(15,23,42,0.7)',
                                    fontSize: '0.82rem',
                                }}
                            >
                                Configure and manage all client entities in one place.
                            </Typography>
                        </Box>
                    </Card>
                    </Box>

                    <Box sx={{ width: { xs: '100%', lg: '50%' }, flexShrink: 0 }}>
                        <Card
                            variant="outlined"
                            sx={{
                                flex: 1,
                                borderRadius: 2,
                                px: 2,
                                py: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                backgroundColor: theme => theme.palette.background.paper,
                                borderColor: theme => theme.palette.divider,
                                boxShadow: 'none',
                                transition: 'background-color 0.15s ease, border-color 0.15s ease',
                                '&:hover': {
                                    backgroundColor: theme => theme.palette.action.hover,
                                    borderColor: theme => theme.palette.text.disabled,
                                },
                            }}
                            onClick={() => navigate('/siteadmin/create-company')}
                        >
                        <Box>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.14em',
                                    fontSize: '0.72rem',
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(237,233,254,0.95)'
                                        : 'rgba(91,33,182,0.95)',
                                    mb: 0.5,
                                }}
                            >
                                Onboarding
                            </Typography>
                            <Typography
                                variant="h5"
                                sx={{
                                    fontWeight: 800,
                                    color: theme => theme.palette.mode === 'dark'
                                        ? '#f5ecff'
                                        : '#111827',
                                    letterSpacing: 0.2,
                                    fontSize: { xs: '1.18rem', sm: '1.36rem', md: '1.45rem' },
                                }}
                            >
                                Company Creation
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    mt: 0.75,
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(237,233,254,0.9)'
                                        : 'rgba(30,64,175,0.78)',
                                    fontSize: '0.82rem',
                                }}
                            >
                                Quickly set up new organizations and start their IFC journey.
                            </Typography>
                        </Box>
                    </Card>
                    </Box>
                </Box>

                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', lg: 'row' },
                    gap: 2.5,
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