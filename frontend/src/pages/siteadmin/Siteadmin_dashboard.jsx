import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import { useMediaQuery } from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { Alert, Select, MenuItem, FormControl, InputLabel, Box, Card, CardHeader, CardContent, Stack, Typography } from '@mui/material';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { apiUrl, API_BASE_URL } from '../../config/api'

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
    const totalUsers = pieData.reduce((sum, d) => sum + d.value, 0)
    const activeCompanyCount = pieData.filter((item) => Number(item.value || 0) > 0).length
    const currentYearUsers = monthlyData.reduce((sum, value) => sum + Number(value || 0), 0)

    const surfaceSx = {
        borderRadius: 2,
        backgroundColor: theme.palette.mode === 'dark'
            ? theme.palette.background.paper
            : alpha(theme.palette.background.paper, 0.92),
        border: `1px solid ${theme.palette.mode === 'dark'
            ? alpha(theme.palette.common.white, 0.1)
            : alpha(theme.palette.primary.main, 0.14)}`,
        boxShadow: theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0,0,0,0.3)'
            : '0 14px 34px rgba(18,52,88,0.08)',
    }

    const summaryCards = [
        {
            label: 'Companies',
            value: companies.length,
            detail: 'registered entities',
            icon: <BusinessRoundedIcon fontSize="small" />,
            tint: theme.palette.primary.main,
        },
        {
            label: 'Users',
            value: totalUsers,
            detail: `across ${activeCompanyCount} active companies`,
            icon: <GroupRoundedIcon fontSize="small" />,
            tint: theme.palette.info.main,
        },
        {
            label: selectedYear,
            value: currentYearUsers,
            detail: 'new users this year',
            icon: <CalendarMonthRoundedIcon fontSize="small" />,
            tint: theme.palette.success.main,
        },
    ]

    const fetchMonthlyData = async (year) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/stats/users/monthly-stats?year=${year}`, {
                credentials: 'include',
            });
            const result = await response.json();

            if (response.ok && result.success) {
                setMonthlyData(result.data.series[0].data);
            } else {
                setError(result.message || 'Failed to fetch monthly user stats');
                setMonthlyData(Array(12).fill(0));
            }
        } catch (error) {
            console.error('Error fetching chart data:', error);
            setError('Error fetching monthly user stats');
            setMonthlyData(Array(12).fill(0));
        } finally {
            setLoading(false);
        }
    };

    const fetchCompanyUserData = async () => {
        try {
            const response = await fetch(
                apiUrl('/api/stats/companies/user-distribution'),
                {
                    credentials: 'include',
                }
            );
            const result = await response.json();

            if (response.ok && result.success) {
                setPieData(result.data.pieData);
            } else {
                setError(result.message || 'Failed to fetch company user stats');
                setPieData([]);
            }
        } catch (error) {
            console.error('Error fetching pie data:', error);
            setError('Error fetching company user stats');
            setPieData([]);
        } finally {
            setLoading(false);
        }
    };

    // Load year range for user stats from backend
    useEffect(() => {
        const fetchYearRange = async () => {
            try {
                const response = await fetch(apiUrl('/api/stats/users/year-range'), {
                    credentials: 'include',
                });
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
            const response = await fetch(apiUrl('/api/siteadmin/companies'), {
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
            px: 0,
            bgcolor: 'transparent'
        }}>
            <Box sx={{ 
                maxWidth: '100%', 
                mx: 'auto',
                width: '100%'
            }}>
                <Box
                    sx={{
                        mb: 3,
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: { xs: 'stretch', md: 'flex-end' },
                        justifyContent: 'space-between',
                        gap: 2,
                    }}
                >
                    <Box>
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 800,
                                color: 'text.primary',
                                fontSize: { xs: '1.65rem', sm: '1.9rem' },
                                lineHeight: 1.2,
                            }}
                        >
                            Siteadmin Dashboard
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 0.75,
                                color: 'text.secondary',
                                maxWidth: 620,
                            }}
                        >
                            Company onboarding, user growth, and organization-level usage at a glance.
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 2,
                            color: 'text.secondary',
                            backgroundColor: theme.palette.mode === 'dark'
                                ? alpha(theme.palette.common.white, 0.06)
                                : alpha(theme.palette.primary.main, 0.07),
                            border: '1px solid',
                            borderColor: theme.palette.mode === 'dark'
                                ? alpha(theme.palette.common.white, 0.1)
                                : alpha(theme.palette.primary.main, 0.12),
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            width: { xs: 'fit-content', md: 'auto' },
                        }}
                    >
                        Reporting year: {selectedYear}
                    </Box>
                </Box>

                {error && (
                    <Alert
                        severity="warning"
                        sx={{
                            mb: 3,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: theme.palette.mode === 'dark'
                                ? alpha(theme.palette.warning.main, 0.28)
                                : alpha(theme.palette.warning.main, 0.34),
                        }}
                    >
                        {error}
                    </Alert>
                )}

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                        gap: 2,
                        mb: 3,
                    }}
                >
                    {summaryCards.map((item) => (
                        <Card
                            key={item.label}
                            variant="outlined"
                            sx={{
                                ...surfaceSx,
                                p: 2,
                                boxShadow: theme.palette.mode === 'dark'
                                    ? '0 8px 24px rgba(0,0,0,0.22)'
                                    : '0 10px 26px rgba(18,52,88,0.06)',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box
                                    sx={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: 2,
                                        display: 'grid',
                                        placeItems: 'center',
                                        color: theme.palette.mode === 'dark'
                                            ? theme.palette.background.default
                                            : theme.palette.common.white,
                                        backgroundColor: item.tint,
                                        flexShrink: 0,
                                    }}
                                >
                                    {item.icon}
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: 'text.secondary',
                                            fontWeight: 800,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.08em',
                                        }}
                                    >
                                        {item.label}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            color: 'text.primary',
                                            fontWeight: 850,
                                            fontSize: { xs: '1.35rem', md: '1.55rem' },
                                            lineHeight: 1.15,
                                        }}
                                    >
                                        {item.value}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                                        {item.detail}
                                    </Typography>
                                </Box>
                            </Box>
                        </Card>
                    ))}
                </Box>

                {/* Quick Navigation Tiles */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', lg: 'row' },
                        gap: 2.5,
                        mb: 3,
                    }}
                >
                    <Box sx={{ width: { xs: '100%', lg: 'calc((100% - 40px) / 3)' }, flexShrink: 0 }}>
                        <Card
                            variant="outlined"
                            sx={{
                                ...surfaceSx,
                                flex: 1,
                                px: 2,
                                py: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                minHeight: 142,
                                transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    borderColor: theme.palette.mode === 'dark'
                                        ? alpha(theme.palette.primary.light, 0.3)
                                        : alpha(theme.palette.primary.main, 0.28),
                                    boxShadow: theme.palette.mode === 'dark'
                                        ? '0 12px 36px rgba(0,0,0,0.34)'
                                        : '0 16px 38px rgba(18,52,88,0.12)',
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

                    <Box sx={{ width: { xs: '100%', lg: 'calc((100% - 40px) / 3)' }, flexShrink: 0 }}>
                        <Card
                            variant="outlined"
                            sx={{
                                ...surfaceSx,
                                flex: 1,
                                px: 2,
                                py: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                minHeight: 142,
                                transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    borderColor: theme.palette.mode === 'dark'
                                        ? alpha(theme.palette.primary.light, 0.3)
                                        : alpha(theme.palette.primary.main, 0.28),
                                    boxShadow: theme.palette.mode === 'dark'
                                        ? '0 12px 36px rgba(0,0,0,0.34)'
                                        : '0 16px 38px rgba(18,52,88,0.12)',
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

                    <Box sx={{ width: { xs: '100%', lg: 'calc((100% - 40px) / 3)' }, flexShrink: 0 }}>
                        <Card
                            variant="outlined"
                            sx={{
                                ...surfaceSx,
                                flex: 1,
                                px: 2,
                                py: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                minHeight: 142,
                                transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    borderColor: theme.palette.mode === 'dark'
                                        ? alpha(theme.palette.primary.light, 0.3)
                                        : alpha(theme.palette.primary.main, 0.28),
                                    boxShadow: theme.palette.mode === 'dark'
                                        ? '0 12px 36px rgba(0,0,0,0.34)'
                                        : '0 16px 38px rgba(18,52,88,0.12)',
                                },
                            }}
                            onClick={() => navigate('/siteadmin/auditors')}
                        >
                        <Box>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.14em',
                                    fontSize: '0.72rem',
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(209,250,229,0.95)'
                                        : 'rgba(4,120,87,0.95)',
                                    mb: 0.5,
                                }}
                            >
                                Access
                            </Typography>
                            <Typography
                                variant="h5"
                                sx={{
                                    fontWeight: 800,
                                    color: theme => theme.palette.mode === 'dark'
                                        ? '#ecfdf5'
                                        : '#111827',
                                    letterSpacing: 0.2,
                                    fontSize: { xs: '1.18rem', sm: '1.36rem', md: '1.45rem' },
                                }}
                            >
                                Auditor Management
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    mt: 0.75,
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(209,250,229,0.9)'
                                        : 'rgba(15,23,42,0.7)',
                                    fontSize: '0.82rem',
                                }}
                            >
                                Create auditors and review login email status.
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
                                ...surfaceSx,
                                height: '100%',
                                minHeight: 550,
                                borderRadius: 3,
                                p: { xs: 2, sm: 3 },
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    boxShadow: theme => theme.palette.mode === 'dark'
                                        ? '0 12px 40px rgba(0,0,0,0.4)'
                                        : '0 18px 42px rgba(18,52,88,0.12)',
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
                                                borderRadius: 2,
                                                backgroundColor: theme.palette.mode === 'dark'
                                                    ? alpha(theme.palette.common.white, 0.03)
                                                    : alpha(theme.palette.common.white, 0.72),
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
                                ...surfaceSx,
                                height: '100%',
                                minHeight: 550,
                                borderRadius: 3,
                                p: { xs: 2, sm: 3 },
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    boxShadow: theme => theme.palette.mode === 'dark'
                                        ? '0 12px 40px rgba(0,0,0,0.4)'
                                        : '0 18px 42px rgba(18,52,88,0.12)',
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
                                        {totalUsers} total users across {pieData.length} companies
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
