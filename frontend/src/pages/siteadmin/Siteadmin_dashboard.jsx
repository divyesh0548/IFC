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
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'

function Siteadmin_Dashboard() {
    const theme = useTheme()
    const navigate = useNavigate()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
    const isTablet = useMediaQuery(theme.breakpoints.down('md'))
    const [companies, setCompanies] = useState([])
    const [companiesLoading, setCompaniesLoading] = useState(true)
    const [monthlyLoading, setMonthlyLoading] = useState(true)
    const [pieLoading, setPieLoading] = useState(true)
    const [yearsLoading, setYearsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [pieData, setPieData] = useState([]);
    const [monthlyData, setMonthlyData] = useState([])
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [years, setYears] = useState([new Date().getFullYear()]);
    const loading = companiesLoading || monthlyLoading || pieLoading || yearsLoading
    useSyncGlobalLoading(loading)
    
    const barChartHeight = isMobile ? 350 : isTablet ? 420 : 450
    const pieChartSize = isMobile ? 280 : isTablet ? 320 : 360
    const pieInnerRadius = isMobile ? 40 : isTablet ? 50 : 60
    const pieOuterRadius = isMobile ? 120 : isTablet ? 140 : 160
    const totalUsers = pieData.reduce((sum, d) => sum + d.value, 0)
    const currentYearUsers = monthlyData.reduce((sum, value) => sum + Number(value || 0), 0)

    const surfaceSx = {
        borderRadius: 3,
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
    const navTileSx = {
        ...surfaceSx,
        p: { xs: 2.25, sm: 2.5 },
        minHeight: 168,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        '&:hover': {
            transform: 'translateY(-2px)',
            borderColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.light, 0.28)
                : alpha(theme.palette.primary.main, 0.24),
            boxShadow: theme.palette.mode === 'dark'
                ? '0 12px 36px rgba(0,0,0,0.34)'
                : '0 16px 38px rgba(18,52,88,0.12)',
        },
    }

    const summaryCards = [
        {
            label: 'Companies',
            value: companies.length,
            icon: <BusinessRoundedIcon fontSize="small" />,
            tint: theme.palette.primary.main,
        },
        {
            label: 'Users',
            value: totalUsers,
            icon: <GroupRoundedIcon fontSize="small" />,
            tint: theme.palette.info.main,
        },
        {
            label: selectedYear,
            value: currentYearUsers,
            icon: <CalendarMonthRoundedIcon fontSize="small" />,
            tint: theme.palette.success.main,
        },
    ]

    const fetchMonthlyData = async (year) => {
        setMonthlyLoading(true);
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
            setMonthlyLoading(false);
        }
    };

    const fetchCompanyUserData = async () => {
        setPieLoading(true)
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
            setPieLoading(false);
        }
    };

    // Load year range for user stats from backend
    useEffect(() => {
        const fetchYearRange = async () => {
            setYearsLoading(true)
            try {
                const response = await fetch(apiUrl('/api/stats/users/year-range'), {
                    credentials: 'include',
                });
                const result = await response.json();

                if (response.ok && result.success && result.data && Array.isArray(result.data.years) && result.data.years.length > 0) {
                    setYears(result.data.years);

                    // If current selected year is outside the range, clamp to latestYear
                    const { earliestYear, latestYear } = result.data;
                    setSelectedYear((currentYear) => (
                        currentYear < earliestYear || currentYear > latestYear
                            ? latestYear
                            : currentYear
                    ));
                } else {
                    // Fallback to last 5 years if API returns no data
                    const currentYear = new Date().getFullYear();
                    setYears(Array.from({ length: 5 }, (_, i) => currentYear - i).reverse());
                }
            } catch (err) {
                console.error('Error fetching user year range:', err);
                const currentYear = new Date().getFullYear();
                setYears(Array.from({ length: 5 }, (_, i) => currentYear - i).reverse());
            } finally {
                setYearsLoading(false)
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
        setCompaniesLoading(true)
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
            setCompaniesLoading(false)
        }
    }

    return (
        <Box sx={{ 
            width: '100%', 
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
                                maxWidth: 700,
                                lineHeight: 1.6,
                            }}
                        >
                            Monitor company onboarding, business-process setup, auditor access, and user growth from one central dashboard.
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
                                p: 2.25,
                                boxShadow: theme.palette.mode === 'dark'
                                    ? '0 8px 24px rgba(0,0,0,0.22)'
                                    : '0 10px 26px rgba(18,52,88,0.06)',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
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
                                <Box sx={{ minWidth: 0, display: 'grid', gap: 0.45 }}>
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
                                </Box>
                            </Box>
                        </Card>
                    ))}
                </Box>

                {/* Quick Navigation Tiles */}
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
                        gap: 2,
                        mb: 3,
                    }}
                >
                    <Card
                        variant="outlined"
                        sx={navTileSx}
                        onClick={() => navigate('/siteadmin/company-management')}
                    >
                        <Box sx={{ display: 'grid', gap: 1.1 }}>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.14em',
                                    fontSize: '0.72rem',
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(226,232,240,0.9)'
                                        : 'rgba(30,64,175,0.9)',
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
                                    fontSize: { xs: '1.15rem', sm: '1.28rem' },
                                    lineHeight: 1.25,
                                }}
                            >
                                Company Management
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(226,232,240,0.85)'
                                        : 'rgba(15,23,42,0.7)',
                                    fontSize: '0.84rem',
                                    lineHeight: 1.6,
                                }}
                            >
                                Create companies, review company profiles, and open company-level details.
                            </Typography>
                        </Box>
                        <Typography sx={{ mt: 2, fontSize: '0.84rem', fontWeight: 700, color: 'primary.main' }}>
                            Open section
                        </Typography>
                    </Card>

                    <Card
                        variant="outlined"
                        sx={navTileSx}
                        onClick={() => navigate('/siteadmin/business-processes')}
                    >
                        <Box sx={{ display: 'grid', gap: 1.1 }}>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.14em',
                                    fontSize: '0.72rem',
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(237,233,254,0.95)'
                                        : 'rgba(91,33,182,0.95)',
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
                                    fontSize: { xs: '1.15rem', sm: '1.28rem' },
                                    lineHeight: 1.25,
                                }}
                            >
                                Business Process Management
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(237,233,254,0.9)'
                                        : 'rgba(30,64,175,0.78)',
                                    fontSize: '0.84rem',
                                    lineHeight: 1.6,
                                }}
                            >
                                Maintain the central business-process master used across uploads, RACMs, and reporting.
                            </Typography>
                        </Box>
                        <Typography sx={{ mt: 2, fontSize: '0.84rem', fontWeight: 700, color: 'primary.main' }}>
                            Open section
                        </Typography>
                    </Card>

                    <Card
                        variant="outlined"
                        sx={navTileSx}
                        onClick={() => navigate('/siteadmin/auditors')}
                    >
                        <Box sx={{ display: 'grid', gap: 1.1 }}>
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.14em',
                                    fontSize: '0.72rem',
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(209,250,229,0.95)'
                                        : 'rgba(4,120,87,0.95)',
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
                                    fontSize: { xs: '1.15rem', sm: '1.28rem' },
                                    lineHeight: 1.25,
                                }}
                            >
                                Auditor Management
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: theme => theme.palette.mode === 'dark'
                                        ? 'rgba(209,250,229,0.9)'
                                        : 'rgba(15,23,42,0.7)',
                                    fontSize: '0.84rem',
                                    lineHeight: 1.6,
                                }}
                            >
                                Add auditors, track login email status, and manage platform access cleanly.
                            </Typography>
                        </Box>
                        <Typography sx={{ mt: 2, fontSize: '0.84rem', fontWeight: 700, color: 'primary.main' }}>
                            Open section
                        </Typography>
                    </Card>
                </Box>

                <Box sx={{ 
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', xl: '1.75fr 1fr' },
                    gap: 2,
                    width: '100%',
                    alignItems: 'stretch'
                }}>
                    {/* User Count Bar Chart */}
                    <Card
                        variant="outlined"
                        sx={{
                            ...surfaceSx,
                            p: { xs: 2, sm: 2.5 },
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                boxShadow: theme => theme.palette.mode === 'dark'
                                    ? '0 12px 40px rgba(0,0,0,0.4)'
                                    : '0 18px 42px rgba(18,52,88,0.12)',
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <CardHeader
                                title={
                                    <Typography 
                                        variant="h6" 
                                        sx={{ 
                                            fontWeight: 800,
                                            fontSize: { xs: '1.08rem', sm: '1.2rem' },
                                        }}
                                    >
                                        New Users per Month
                                    </Typography>
                                }
                                subheader={
                                    <Typography 
                                        variant="body2" 
                                        color="text.secondary"
                                        sx={{ mt: 0.35, lineHeight: 1.6 }}
                                    >
                                        Monthly user registrations across all companies
                                    </Typography>
                                }
                                sx={{ 
                                    p: 0
                                }}
                            />
                            <CardContent sx={{ 
                                px: 0,
                                py: 0,
                                '&:last-child': { pb: 0 } 
                            }}>
                                <Stack 
                                    direction="row" 
                                    alignItems="center" 
                                    spacing={2} 
                                    mb={2}
                                >
                                    <FormControl 
                                        size="small" 
                                        sx={{ 
                                            minWidth: 140,
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
                                    height: barChartHeight - 30, 
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
                        </Box>
                    </Card>

                    {/* User Distribution Pie Chart */}
                    <Card
                        variant="outlined"
                        sx={{
                            ...surfaceSx,
                            p: { xs: 2, sm: 2.5 },
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                boxShadow: theme => theme.palette.mode === 'dark'
                                    ? '0 12px 40px rgba(0,0,0,0.4)'
                                    : '0 18px 42px rgba(18,52,88,0.12)',
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
                            <CardHeader
                                title={
                                    <Typography 
                                        variant="h6" 
                                        sx={{ 
                                            fontWeight: 800,
                                            fontSize: { xs: '1.08rem', sm: '1.2rem' },
                                        }}
                                    >
                                         Users by Company
                                    </Typography>
                                }
                                subheader={
                                    <Typography 
                                        variant="body2" 
                                        color="text.secondary"
                                        sx={{ mt: 0.35, lineHeight: 1.6 }}
                                    >
                                        {totalUsers} total users across {pieData.length} companies
                                    </Typography>
                                }
                                sx={{ 
                                    p: 0
                                }}
                            />
                            <CardContent sx={{ 
                                px: 0,
                                py: 0,
                                textAlign: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 360,
                                '&:last-child': { pb: 0 }
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
                        </Box>
                    </Card>
                </Box>
            </Box>
        </Box>
    )
}

export default Siteadmin_Dashboard
