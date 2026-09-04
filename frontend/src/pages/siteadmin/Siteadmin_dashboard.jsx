import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { alpha, useTheme } from '@mui/material/styles'
import { useMediaQuery } from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { Alert, Select, MenuItem, FormControl, InputLabel, Box, Card, CardHeader, CardContent, Paper, Stack, Typography } from '@mui/material';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import QuestionAnswerRoundedIcon from '@mui/icons-material/QuestionAnswerRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import { apiUrl, API_BASE_URL } from '../../config/api'
import { useSyncGlobalLoading } from '../../contexts/GlobalLoadingContext'
import DashboardGreeting from '../../components/DashboardGreeting'

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
    const [totalRacms, setTotalRacms] = useState(0)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [years, setYears] = useState([new Date().getFullYear()]);
    const loading = companiesLoading || monthlyLoading || pieLoading || yearsLoading
    useSyncGlobalLoading(loading)
    
    const barChartHeight = isMobile ? 350 : isTablet ? 420 : 450
    const pieChartSize = isMobile ? 280 : isTablet ? 320 : 360
    const pieInnerRadius = isMobile ? 40 : isTablet ? 50 : 60
    const pieOuterRadius = isMobile ? 120 : isTablet ? 140 : 160
    const totalUsers = pieData.reduce((sum, d) => sum + d.value, 0)
    const sectionGap = 2
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
    const sectionTitleSx = {
        fontWeight: 800,
        color: theme.palette.text.primary,
        fontSize: { xs: '1.02rem', sm: '1.08rem' },
        lineHeight: 1.3,
    }
    const sectionSubtextSx = {
        color: alpha(theme.palette.text.secondary, 0.92),
        fontSize: '0.88rem',
        lineHeight: 1.55,
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
            label: 'Total RACMs',
            value: totalRacms,
            icon: <FactCheckRoundedIcon fontSize="small" />,
            tint: theme.palette.success.main,
        },
    ]
    const tiles = [
        {
            eyebrow: 'Administration',
            title: 'Company Management',
            description: 'Create companies, review company profiles, and open company-level details.',
            path: '/siteadmin/company-management',
            action: 'Manage companies',
            icon: BusinessRoundedIcon,
            accent: theme.palette.primary.main,
        },
        {
            eyebrow: 'Onboarding',
            title: 'Business Process Management',
            description: 'Maintain the central business-process master across all companies.',
            path: '/siteadmin/business-processes',
            action: 'Open processes',
            icon: AccountTreeRoundedIcon,
            accent: theme.palette.info.main,
        },
        {
            eyebrow: 'Control Library',
            title: 'Controls Library',
            description: 'Upload control-library suggestions by business process for coordinator use.',
            path: '/siteadmin/controls-library',
            action: 'Open library',
            icon: LibraryBooksRoundedIcon,
            accent: theme.palette.success.main,
        },
        {
            eyebrow: 'Access',
            title: 'Auditor Management',
            description: 'Add auditors, track login email status, and manage platform access cleanly.',
            path: '/siteadmin/auditors',
            action: 'Manage auditors',
            icon: ManageAccountsRoundedIcon,
            accent: theme.palette.warning.main,
        },
        {
            eyebrow: 'Support',
            title: 'User Queries',
            description: 'Review website issues and suggestions submitted by users across the platform.',
            path: '/siteadmin/user-queries',
            action: 'Review queries',
            icon: QuestionAnswerRoundedIcon,
            accent: theme.palette.secondary.main,
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

    const fetchSummaryStats = async () => {
        try {
            const response = await fetch(apiUrl('/api/stats'), {
                credentials: 'include',
            })
            const result = await response.json()

            if (response.ok && result.success) {
                setTotalRacms(Number(result.data?.totalRacms || 0))
            } else {
                setError(result.message || 'Failed to fetch summary stats')
                setTotalRacms(0)
            }
        } catch (fetchError) {
            console.error('Error fetching summary stats:', fetchError)
            setError('Error fetching summary stats')
            setTotalRacms(0)
        }
    }

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
        fetchSummaryStats();
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

                {error && (
                    <Alert
                        severity="warning"
                        sx={{
                            mb: sectionGap,
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
                        position: 'relative',
                        overflow: 'hidden',
                        mb: sectionGap,
                        borderRadius: 4,
                        border: '1px solid',
                        borderColor: theme.palette.mode === 'dark'
                            ? alpha(theme.palette.common.white, 0.08)
                            : alpha(theme.palette.primary.main, 0.12),
                        background: theme.palette.gradients?.hero || `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.18)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 100%)`,
                        boxShadow: theme.palette.mode === 'dark'
                            ? '0 20px 48px rgba(0, 0, 0, 0.32)'
                            : '0 20px 48px rgba(15, 23, 42, 0.08)',
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            top: -70,
                            right: -30,
                            width: 220,
                            height: 220,
                            borderRadius: '50%',
                            background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.18)} 0%, transparent 72%)`,
                        }}
                    />
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: -90,
                            left: -40,
                            width: 240,
                            height: 240,
                            borderRadius: '50%',
                            background: `radial-gradient(circle, ${alpha(theme.palette.primary.light, 0.14)} 0%, transparent 70%)`,
                        }}
                    />
                    <Box
                        sx={{
                            position: 'relative',
                            p: { xs: 2.75, sm: 3.75, md: 4.25 },
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.55fr) minmax(240px, 0.78fr)' },
                            gap: sectionGap,
                            alignItems: 'stretch',
                            minHeight: { xs: 260, md: 290 },
                        }}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 1.4,
                                    py: 0.7,
                                    borderRadius: 999,
                                    mb: 2,
                                    backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.12 : 0.72),
                                    border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.16)}`,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        backgroundColor: theme.palette.success.main,
                                        boxShadow: `0 0 0 4px ${alpha(theme.palette.success.main, 0.16)}`,
                                    }}
                                />
                                <Typography sx={{ fontSize: '0.80rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                                    Admin Workspace
                                </Typography>
                            </Box>
                            <DashboardGreeting
                                primarySx={{
                                    fontSize: { xs: '1.85rem', sm: '2.3rem', md: '2.6rem' },
                                    fontWeight: 900,
                                    color: theme.palette.text.primary,
                                    lineHeight: 1.08,
                                    letterSpacing: '-0.03em',
                                }}
                            />
                            <Typography
                                sx={{
                                    mt: 1.1,
                                    maxWidth: { xs: '100%', lg: 700 },
                                    color: theme.palette.text.secondary,
                                    fontSize: { xs: '0.96rem', sm: '1rem' },
                                    lineHeight: 1.7,
                                }}
                            >
                                Monitor company onboarding, user growth, and platform access from one central workspace.
                            </Typography>
                            <Box
                                sx={{
                                    mt: 1.8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.75,
                                }}
                            >
                                <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                                    Reporting year :
                                </Typography>
                                <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: theme.palette.text.primary }}>
                                    {selectedYear}
                                </Typography>
                            </Box>
                        </Box>

                        <Paper
                            elevation={0}
                            sx={{
                                p: 2.2,
                                borderRadius: 3,
                                border: '1px solid',
                                borderColor: theme.palette.mode === 'dark'
                                    ? alpha(theme.palette.common.white, 0.08)
                                    : alpha(theme.palette.divider, 1),
                                backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.52 : 0.82),
                                backdropFilter: 'blur(8px)',
                                display: 'grid',
                                gap: 1.2,
                                alignContent: 'start',
                                minHeight: '100%',
                            }}
                        >
                            {/* <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                                Reporting Snapshot
                            </Typography> */}
                            <Typography sx={sectionTitleSx}>
                                Siteadmin Statistics
                            </Typography>
                            <Box sx={{ display: 'grid', gap: 1.4 }}>
                                {summaryCards.map((item) => (
                                    <Box
                                        key={item.label}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 2,
                                            py: 1.05,
                                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.75)}`,
                                            '&:last-of-type': {
                                                borderBottom: 'none',
                                                pb: 0,
                                            },
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, minWidth: 0 }}>
                                            <Box
                                                sx={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '50%',
                                                    backgroundColor: item.tint,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                                                {item.label}
                                            </Typography>
                                        </Box>
                                        <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: theme.palette.text.primary }}>
                                            {item.value}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Paper>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, mb: sectionGap }}>
                    <Box sx={{ px: { xs: 0.25, sm: 0.5 } }}>
                        <Typography
                            sx={{
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: theme.palette.text.secondary,
                            }}
                        >
                            Quick access
                        </Typography>
                        <Typography sx={{ mt: 0.5, color: alpha(theme.palette.text.secondary, 0.9), fontSize: '0.95rem' }}>
                            Jump into the module you need — each path keeps its own focus.
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                            gap: 2,
                            alignItems: 'stretch',
                        }}
                    >
                        {tiles.map((tile) => {
                            const Icon = tile.icon
                            const isDark = theme.palette.mode === 'dark'
                            return (
                                <Box
                                    key={tile.title}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => navigate(tile.path)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault()
                                            navigate(tile.path)
                                        }
                                    }}
                                    sx={{
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        minHeight: 132,
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        border: '1px solid',
                                        borderColor: isDark ? alpha(tile.accent, 0.22) : alpha(theme.palette.divider, 0.95),
                                        backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.88 : 1),
                                        boxShadow: isDark
                                            ? '0 8px 20px rgba(0, 0, 0, 0.2)'
                                            : '0 8px 20px rgba(15, 23, 42, 0.04)',
                                        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            borderColor: alpha(tile.accent, 0.55),
                                            boxShadow: isDark
                                                ? '0 16px 32px rgba(0, 0, 0, 0.28)'
                                                : `0 16px 32px ${alpha(tile.accent, 0.12)}`,
                                            '& .tile-arrow': {
                                                transform: 'translate(2px, -2px)',
                                                opacity: 1,
                                            },
                                            '& .tile-icon-wrap': {
                                                transform: 'scale(1.04)',
                                                backgroundColor: alpha(tile.accent, isDark ? 0.28 : 0.16),
                                            },
                                        },
                                        '&:focus-visible': {
                                            borderColor: tile.accent,
                                            boxShadow: `0 0 0 3px ${alpha(tile.accent, 0.28)}`,
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 5,
                                            flexShrink: 0,
                                            background: `linear-gradient(180deg, ${tile.accent} 0%, ${alpha(tile.accent, 0.45)} 100%)`,
                                        }}
                                    />
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            display: 'flex',
                                            gap: 2,
                                            alignItems: 'flex-start',
                                            p: { xs: 2, sm: 2.25 },
                                            background: `linear-gradient(135deg, ${alpha(tile.accent, isDark ? 0.14 : 0.06)} 0%, transparent 55%)`,
                                        }}
                                    >
                                        <Box
                                            className="tile-icon-wrap"
                                            sx={{
                                                width: 52,
                                                height: 52,
                                                borderRadius: 2.5,
                                                flexShrink: 0,
                                                display: 'grid',
                                                placeItems: 'center',
                                                color: tile.accent,
                                                backgroundColor: alpha(tile.accent, isDark ? 0.2 : 0.1),
                                                border: `1px solid ${alpha(tile.accent, isDark ? 0.28 : 0.18)}`,
                                                transition: 'transform 180ms ease, background-color 180ms ease',
                                            }}
                                        >
                                            <Icon sx={{ fontSize: 28 }} />
                                        </Box>

                                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.85 }}>
                                            <Typography
                                                sx={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 800,
                                                    letterSpacing: '0.06em',
                                                    textTransform: 'uppercase',
                                                    color: tile.accent,
                                                }}
                                            >
                                                {tile.eyebrow}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    fontWeight: 800,
                                                    fontSize: '1.05rem',
                                                    lineHeight: 1.25,
                                                    color: theme.palette.text.primary,
                                                    letterSpacing: '-0.01em',
                                                }}
                                            >
                                                {tile.title}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    color: alpha(theme.palette.text.secondary, 0.95),
                                                    fontSize: '0.88rem',
                                                    lineHeight: 1.55,
                                                }}
                                            >
                                                {tile.description}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    mt: 0.5,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 0.6,
                                                    alignSelf: 'flex-start',
                                                    color: tile.accent,
                                                }}
                                            >
                                                <Typography sx={{ fontSize: '0.84rem', fontWeight: 800 }}>
                                                    {tile.action}
                                                </Typography>
                                                <ArrowOutwardRoundedIcon
                                                    className="tile-arrow"
                                                    sx={{
                                                        fontSize: 17,
                                                        opacity: 0.85,
                                                        transition: 'transform 180ms ease, opacity 180ms ease',
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                            )
                        })}
                    </Box>
                </Box>

                <Box sx={{ 
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', xl: '1.75fr 1fr' },
                    gap: sectionGap,
                    width: '100%',
                    alignItems: 'stretch'
                }}>
                    {/* User Count Bar Chart */}
                    <Card
                        variant="outlined"
                        sx={{
                            ...surfaceSx,
                            p: 0,
                            overflow: 'hidden',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                boxShadow: theme => theme.palette.mode === 'dark'
                                    ? '0 12px 40px rgba(0,0,0,0.4)'
                                    : '0 18px 42px rgba(18,52,88,0.12)',
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            <CardHeader
                                title={
                                    <Typography 
                                        variant="h6" 
                                        sx={sectionTitleSx}
                                    >
                                        Monthly User Registrations
                                    </Typography>
                                }
                                subheader={
                                    <Typography 
                                        variant="body2" 
                                        color="text.secondary"
                                        sx={{ ...sectionSubtextSx, mt: 0.35 }}
                                    >
                                        Monthly user registrations across all companies
                                    </Typography>
                                }
                                sx={{ 
                                    p: { xs: 1.5, sm: 1.75 },
                                    borderRadius: 0,
                                    backgroundColor: theme.palette.mode === 'dark'
                                        ? alpha(theme.palette.common.white, 0.04)
                                        : alpha(theme.palette.primary.main, 0.05),
                                    borderBottom: '1px solid',
                                    borderColor: theme.palette.mode === 'dark'
                                        ? alpha(theme.palette.common.white, 0.08)
                                        : alpha(theme.palette.primary.main, 0.12),
                                }}
                            />
                            <CardContent sx={{ 
                                px: { xs: 2, sm: 2.5 },
                                py: { xs: 2, sm: 2.5 },
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
                            p: 0,
                            overflow: 'hidden',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                                boxShadow: theme => theme.palette.mode === 'dark'
                                    ? '0 12px 40px rgba(0,0,0,0.4)'
                                    : '0 18px 42px rgba(18,52,88,0.12)',
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
                            <CardHeader
                                title={
                                    <Typography 
                                        variant="h6" 
                                        sx={sectionTitleSx}
                                    >
                                        User Distribution by Company
                                    </Typography>
                                }
                                subheader={
                                    <Typography 
                                        variant="body2" 
                                        color="text.secondary"
                                        sx={{ ...sectionSubtextSx, mt: 0.35 }}
                                    >
                                        {totalUsers} total users across {pieData.length} companies
                                    </Typography>
                                }
                                sx={{ 
                                    p: { xs: 1.5, sm: 1.75 },
                                    borderRadius: 0,
                                    backgroundColor: theme.palette.mode === 'dark'
                                        ? alpha(theme.palette.common.white, 0.04)
                                        : alpha(theme.palette.primary.main, 0.05),
                                    borderBottom: '1px solid',
                                    borderColor: theme.palette.mode === 'dark'
                                        ? alpha(theme.palette.common.white, 0.08)
                                        : alpha(theme.palette.primary.main, 0.12),
                                }}
                            />
                            <CardContent sx={{ 
                                px: { xs: 2, sm: 2.5 },
                                py: { xs: 2, sm: 2.5 },
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
