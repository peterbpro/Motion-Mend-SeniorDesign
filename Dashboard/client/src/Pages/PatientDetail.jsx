import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDoctorAuth } from '../utils/auth';
import { useDoctor } from "../DoctorContext";
import "./PatientDetail.css";
import config from "../../config.json";
import Header from '../Components/Header';
import AdjustPlanModal from '../Components/AdjustPlanModal';

const PatientDetail = () => {
    const { currentPatientId } = useDoctor();
    const navigate = useNavigate();
    const [patientName, setPatientName] = useState("");
    const [patientData, setPatientData] = useState({});
    const [error, setError] = useState(null);
    const doctorData = React.useMemo(() => getDoctorAuth(), []);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTreatmentPlan, setCurrentTreatmentPlan] = useState(null);

    const fetchPatientData = React.useCallback(async () => {
        if (!currentPatientId) {
            navigate("/doctor-dashboard");
            return;
        }

        setLoading(true);
        setError('');
        try {
            const response = await fetch(`http://${config.server_host}:${config.server_port}/patient_data/${currentPatientId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch patient data');
            }
            const data = await response.json();
            console.log('Raw patient data from database:', data);
            setPatientName(data.name);
            setPatientData(data.data);
            console.log('Processed patient data:', data.data);
        } catch (err) {
            console.error('Error fetching patient data:', err);
            setError('Failed to load patient data. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [currentPatientId, navigate]);

    useEffect(() => {
        if (!doctorData) {
            navigate("/doctor-login");
            return;
        }
        if (!currentPatientId) {
            navigate("/doctor-dashboard");
            return;
        }
        fetchPatientData();
    }, [doctorData, currentPatientId, navigate, fetchPatientData]);

    const formatTime = (timeString) => {
        if (!timeString) return 'N/A';
        try {
            if (timeString instanceof Date) {
                timeString = timeString.toTimeString().split(' ')[0];
            }
            const parts = timeString.split(':');
            if (parts.length >= 2) {
                return parts.slice(0, 2).join(':');
            }
            return 'N/A';
        } catch (e) {
            console.error("Error formatting time:", timeString, e);
            return 'N/A';
        }
    };

    const handleAdjustPlanClick = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleSaveChanges = () => {
        fetchPatientData();
        console.log("Plan adjusted, refreshing data...");
    };

    // Build progress data, but label each distinct date with a dayCounter
    const getProgressData = React.useCallback(() => {
        if (!patientData || Object.keys(patientData).length === 0) return [];

        const sortedEntries = Object.entries(patientData)
            .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB));

        if (sortedEntries.length === 0) return [];

        // Get the first and last dates
        const firstDate = new Date(sortedEntries[0][0]);
        const lastDate = new Date(sortedEntries[sortedEntries.length - 1][0]);

        // Create an array of all dates between first and last
        const allDates = [];
        const currentDate = new Date(firstDate);
        while (currentDate <= lastDate) {
            allDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let dayCounter = 1;
        return allDates.map(date => {
            const dateString = date.toISOString().split('T')[0];
            const sessions = patientData[dateString] || [];

            const maxAngle = sessions.length > 0
                ? Math.max(...sessions.map(s => s.max_angle).filter(a => typeof a === 'number'))
                : 0; // Return 0 for days with no sessions

            const firstSessionWithGoal = sessions.find(
                s => s.angle_goal !== null && typeof s.angle_goal === 'number'
            );
            const goalAngle = firstSessionWithGoal ? firstSessionWithGoal.angle_goal : null;
            const validReps = sessions.map(s => s.reps).filter(r => typeof r === 'number');
            const avgReps = validReps.length > 0
                ? Math.round(validReps.reduce((sum, s) => sum + s, 0) / validReps.length)
                : 0;

            const result = {
                date: dateString,
                maxAngle: sessions.length > 0 ? maxAngle : 0, // Explicitly set to 0 for skipped days
                goalAngle,
                avgReps,
                sessions: sessions.length,
                day: dayCounter
            };
            dayCounter++;
            return result;
        });
    }, [patientData]);

    // Build chart info for angle progress
    const getChartData = React.useCallback(() => {
        const data = getProgressData();
        if (data.length === 0) return null;

        // Take only the last 7 days of data
        const lastSevenDays = data.slice(-7);

        // Fixed chart dimensions
        const width = 600;
        const height = 300;
        const padding = { top: 30, right: 60, bottom: 70, left: 65 };

        // Always use fixed range from 0 to 90 degrees for knee angle
        const maxValue = 90;
        const minValue = 0;

        // Create evenly spaced tick values (0, 15, 30, 45, 60, 75, 90)
        const tickValues = [0, 15, 30, 45, 60, 75, 90];

        const scaleY = (value) => {
            if (value === null || typeof value !== 'number') return height - padding.bottom;
            const scaled = (value / maxValue) * (height - padding.top - padding.bottom);
            return height - padding.bottom - Math.max(0, Math.min(height - padding.top - padding.bottom, scaled));
        };

        // Fixed spacing for 7 days
        const scaleX = (index) => {
            const effectiveWidth = width - padding.left - padding.right;
            return padding.left + (index * (effectiveWidth / 6)); // 6 intervals for 7 points
        };

        return {
            width,
            height,
            data: lastSevenDays,
            maxValue,
            minValue,
            scaleY,
            scaleX,
            padding,
            tickValues
        };
    }, [getProgressData]);

    // Build chart info for daily exercise duration
    const getDurationChartData = React.useCallback(() => {
        if (!patientData || Object.keys(patientData).length === 0) return null;

        const sortedEntries = Object.entries(patientData)
            .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB));

        if (sortedEntries.length === 0) return null;

        // Get the first and last dates
        const firstDate = new Date(sortedEntries[0][0]);
        const lastDate = new Date(sortedEntries[sortedEntries.length - 1][0]);

        // Create an array of all dates between first and last
        const allDates = [];
        const currentDate = new Date(firstDate);
        while (currentDate <= lastDate) {
            allDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let dayCounter = Math.max(1, sortedEntries.length - 6); // Start day number based on total history
        const durationsData = allDates.map(date => {
            const dateString = date.toISOString().split('T')[0];
            const sessions = patientData[dateString] || [];

            const totalDuration = sessions.reduce(
                (sum, s) => sum + (s.duration || 0), 0
            );

            return {
                date: dateString,
                totalDuration: sessions.length > 0 ? totalDuration : 0, // Explicitly set to 0 for skipped days
                day: dayCounter++
            };
        });

        // Take only the last 7 days
        const lastSevenDays = durationsData.slice(-7);

        // Fixed chart dimensions
        const width = 600;
        const height = 300;
        const padding = { top: 30, right: 60, bottom: 70, left: 65 };

        const validDurations = lastSevenDays.map(d => d.totalDuration)
            .filter(d => typeof d === 'number');
        if (validDurations.length === 0) return null;

        const maxDuration = Math.max(...validDurations);
        const maxMinutes = Math.ceil(maxDuration / 60);
        const adjustedMaxMinutes = Math.max(5, Math.ceil(maxMinutes / 1) * 1);
        const adjustedMaxDuration = adjustedMaxMinutes * 60;
        const minDuration = 0;

        const tickValues = Array.from(
            { length: adjustedMaxMinutes + 1 },
            (_, i) => i * 60
        );

        const scaleY = (value) => {
            if (value === null || typeof value !== 'number') return height - padding.bottom;
            if (adjustedMaxDuration === minDuration) return height - padding.bottom;
            const scaled = ((value - minDuration) / (adjustedMaxDuration - minDuration)) *
                (height - padding.top - padding.bottom);
            return height - padding.bottom -
                Math.max(0, Math.min(height - padding.top - padding.bottom, scaled));
        };

        // Fixed spacing for 7 days
        const scaleX = (index) => {
            const effectiveWidth = width - padding.left - padding.right;
            return padding.left + (index * (effectiveWidth / 6)); // 6 intervals for 7 points
        };

        return {
            width,
            height,
            data: lastSevenDays,
            maxValue: adjustedMaxDuration,
            minValue: minDuration,
            scaleY,
            scaleX,
            padding,
            tickValues
        };
    }, [patientData]);

    return (
        <>
            <Header />
            <div className="page-container">
                <div className="patient-detail-content">
                    <div className="detail-header">
                        <button
                            onClick={() => navigate('/doctor-dashboard')}
                            className="back-button-minimalist"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <h1 className="patient-name">{patientName}</h1>
                        <button
                            onClick={handleAdjustPlanClick}
                            className="adjust-plan-button"
                        >
                            Adjust Plan
                        </button>
                    </div>

                    {loading ? (
                        <div className="loading">Loading...</div>
                    ) : error ? (
                        <div className="error-message">{error}</div>
                    ) : Object.keys(patientData).length === 0 ? (
                        <div className="no-data-message">
                            <div className="no-data-icon">📊</div>
                            <h2 className="no-data-title">No exercise data available yet</h2>
                            <p className="no-data-text">This patient hasn't completed any exercise sessions.</p>
                            <div className="no-data-steps">
                                <h3>Next steps:</h3>
                                <ol>
                                    <li>Ensure the patient has downloaded the MotionMend app</li>
                                    <li>Verify they can log in with their credentials</li>
                                    <li>Encourage them to complete their first exercise session</li>
                                </ol>
                            </div>
                            <p className="no-data-subtitle">
                                Data will appear here automatically once the patient completes exercises.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="progress-analytics">
                                <div className="analytics-card">
                                    <h3>{patientName}'s Angle Progress</h3>
                                    <div className="chart-container">
                                        {getChartData() && (
                                            <div className="line-chart-wrapper">
                                                <svg
                                                    width="100%"
                                                    height="400px"
                                                    viewBox={`0 0 ${getChartData().width} ${getChartData().height}`}
                                                    preserveAspectRatio="xMidYMid meet"
                                                    style={{ overflow: "visible" }}
                                                >
                                                    {/* Grid lines */}
                                                    {getChartData().tickValues.map(tick => (
                                                        <line
                                                            key={`grid-${tick}`}
                                                            x1={getChartData().padding.left}
                                                            y1={getChartData().scaleY(tick)}
                                                            x2={getChartData().width - getChartData().padding.right}
                                                            y2={getChartData().scaleY(tick)}
                                                            stroke="#f0f0f0"
                                                            strokeWidth="1"
                                                        />
                                                    ))}

                                                    {/* Y-axis */}
                                                    <line
                                                        x1={getChartData().padding.left}
                                                        y1={getChartData().padding.top - 10}
                                                        x2={getChartData().padding.left}
                                                        y2={getChartData().height - getChartData().padding.bottom}
                                                        stroke="#d0d0d0"
                                                        strokeWidth="1.5"
                                                    />

                                                    {/* X-axis */}
                                                    <line
                                                        x1={getChartData().padding.left - 10}
                                                        y1={getChartData().height - getChartData().padding.bottom}
                                                        x2={getChartData().width - getChartData().padding.right + 10}
                                                        y2={getChartData().height - getChartData().padding.bottom}
                                                        className="axis-line"
                                                    />

                                                    {/* X-axis grid lines */}
                                                    {Array.from({ length: 7 }, (_, i) => {
                                                        const x = getChartData().scaleX(i);
                                                        const dayNumber = getChartData().data[i]?.day || i + 1;
                                                        return (
                                                            <React.Fragment key={`x-grid-${i}`}>
                                                                <line
                                                                    x1={x}
                                                                    y1={getChartData().padding.top}
                                                                    x2={x}
                                                                    y2={getChartData().height - getChartData().padding.bottom}
                                                                    stroke="#f0f0f0"
                                                                    strokeWidth="1"
                                                                />
                                                                <text
                                                                    x={x}
                                                                    y={getChartData().height - getChartData().padding.bottom + 20}
                                                                    textAnchor="middle"
                                                                    className="tick-label"
                                                                >
                                                                    Day {dayNumber}
                                                                </text>
                                                            </React.Fragment>
                                                        );
                                                    })}

                                                    {/* X-axis label */}
                                                    <text
                                                        x={getChartData().width / 2}
                                                        y={getChartData().height - 10}
                                                        textAnchor="middle"
                                                        className="axis-label"
                                                    >
                                                        Treatment Day
                                                    </text>

                                                    {/* Y-axis ticks and labels */}
                                                    {getChartData().tickValues.map(tick => (
                                                        <g key={tick}>
                                                            <line
                                                                x1={getChartData().padding.left - 5}
                                                                y1={getChartData().scaleY(tick)}
                                                                x2={getChartData().padding.left}
                                                                y2={getChartData().scaleY(tick)}
                                                                stroke="#d0d0d0"
                                                                strokeWidth="1.5"
                                                            />
                                                            <text
                                                                x={getChartData().padding.left - 10}
                                                                y={getChartData().scaleY(tick)}
                                                                textAnchor="end"
                                                                alignmentBaseline="middle"
                                                                fill="#555555"
                                                                fontSize="11px"
                                                                fontWeight="500"
                                                            >
                                                                {tick}°
                                                            </text>
                                                        </g>
                                                    ))}

                                                    {/* Legend with background for better visibility */}
                                                    <g transform={`translate(${getChartData().width - getChartData().padding.right - 80}, 15)`}>
                                                        <rect x="-15" y="-10" width="95" height="50" rx="4" fill="white" fillOpacity="0.9" stroke="#eaeaea" />
                                                        <g transform="translate(0, 0)">
                                                            <circle cx="0" cy="0" r="5" fill="#0066cc" />
                                                            <text x="10" y="4" fill="#555555" fontSize="11px" fontWeight="500">Achieved</text>
                                                        </g>
                                                        <g transform="translate(0, 25)">
                                                            <circle cx="0" cy="0" r="5" fill="#aaaaaa" />
                                                            <text x="10" y="4" fill="#555555" fontSize="11px" fontWeight="500">Target</text>
                                                        </g>
                                                    </g>

                                                    {/* Goal angle line */}
                                                    <path
                                                        d={getChartData().data.map((dayData, i) => {
                                                            if (dayData.goalAngle === null || typeof dayData.goalAngle !== 'number') return "";
                                                            const x = getChartData().scaleX(i);
                                                            const y = getChartData().scaleY(dayData.goalAngle);
                                                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                                        }).join(' ')}
                                                        stroke="#aaaaaa"
                                                        strokeWidth="2"
                                                        strokeDasharray="4,4"
                                                        fill="none"
                                                    />

                                                    {/* Achieved angle line */}
                                                    <path
                                                        d={getChartData().data.map((dayData, i) => {
                                                            if (dayData.maxAngle === null || typeof dayData.maxAngle !== 'number') return "";
                                                            const x = getChartData().scaleX(i);
                                                            const y = getChartData().scaleY(dayData.maxAngle);
                                                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                                        }).join(' ')}
                                                        stroke="#0066cc"
                                                        strokeWidth="2.5"
                                                        fill="none"
                                                    />

                                                    {/* Data points */}
                                                    {getChartData().data.map((dayData, i) => {
                                                        const x = getChartData().scaleX(i);
                                                        return (
                                                            <g key={dayData.date}>
                                                                {dayData.goalAngle !== null && typeof dayData.goalAngle === 'number' && (
                                                                    <circle
                                                                        cx={x}
                                                                        cy={getChartData().scaleY(dayData.goalAngle)}
                                                                        r="5"
                                                                        fill="#aaaaaa"
                                                                        stroke="white"
                                                                        strokeWidth="1.5"
                                                                    >
                                                                        <title>{`Prescribed: ${dayData.goalAngle}°`}</title>
                                                                    </circle>
                                                                )}
                                                                {dayData.maxAngle !== null && typeof dayData.maxAngle === 'number' && (
                                                                    <circle
                                                                        cx={x}
                                                                        cy={getChartData().scaleY(dayData.maxAngle)}
                                                                        r="5"
                                                                        fill="#0066cc"
                                                                        stroke="white"
                                                                        strokeWidth="1.5"
                                                                        className="data-point"
                                                                    >
                                                                        <title>{`Achieved: ${dayData.maxAngle}°`}</title>
                                                                    </circle>
                                                                )}
                                                            </g>
                                                        );
                                                    })}
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="analytics-card">
                                    <h3>Daily Exercise Duration</h3>
                                    <div className="chart-container">
                                        {getDurationChartData() && (
                                            <div className="line-chart-wrapper">
                                                <svg
                                                    width="100%"
                                                    height="400px"
                                                    viewBox={`0 0 ${getDurationChartData().width} ${getDurationChartData().height}`}
                                                    preserveAspectRatio="xMidYMid meet"
                                                    style={{ overflow: "visible" }}
                                                >
                                                    {/* Grid lines */}
                                                    {getDurationChartData().tickValues.map(tick => (
                                                        <line
                                                            key={`grid-${tick}`}
                                                            x1={getDurationChartData().padding.left}
                                                            y1={getDurationChartData().scaleY(tick)}
                                                            x2={getDurationChartData().width - getDurationChartData().padding.right}
                                                            y2={getDurationChartData().scaleY(tick)}
                                                            stroke="#f0f0f0"
                                                            strokeWidth="1"
                                                        />
                                                    ))}

                                                    {/* Y-axis */}
                                                    <line
                                                        x1={getDurationChartData().padding.left}
                                                        y1={getDurationChartData().padding.top - 10}
                                                        x2={getDurationChartData().padding.left}
                                                        y2={getDurationChartData().height - getDurationChartData().padding.bottom}
                                                        stroke="#d0d0d0"
                                                        strokeWidth="1.5"
                                                    />

                                                    {/* X-axis */}
                                                    <line
                                                        x1={getDurationChartData().padding.left - 10}
                                                        y1={getDurationChartData().height - getDurationChartData().padding.bottom}
                                                        x2={getDurationChartData().width - getDurationChartData().padding.right + 10}
                                                        y2={getDurationChartData().height - getDurationChartData().padding.bottom}
                                                        className="axis-line"
                                                    />

                                                    {/* X-axis grid lines */}
                                                    {Array.from({ length: 7 }, (_, i) => {
                                                        const x = getDurationChartData().scaleX(i);
                                                        const dayNumber = getDurationChartData().data[i]?.day || i + 1;
                                                        return (
                                                            <React.Fragment key={`x-grid-${i}`}>
                                                                <line
                                                                    x1={x}
                                                                    y1={getDurationChartData().padding.top}
                                                                    x2={x}
                                                                    y2={getDurationChartData().height - getDurationChartData().padding.bottom}
                                                                    stroke="#f0f0f0"
                                                                    strokeWidth="1"
                                                                />
                                                                <text
                                                                    x={x}
                                                                    y={getDurationChartData().height - getDurationChartData().padding.bottom + 20}
                                                                    textAnchor="middle"
                                                                    className="tick-label"
                                                                >
                                                                    Day {dayNumber}
                                                                </text>
                                                            </React.Fragment>
                                                        );
                                                    })}

                                                    {/* X-axis label */}
                                                    <text
                                                        x={getDurationChartData().width / 2}
                                                        y={getDurationChartData().height - 10}
                                                        textAnchor="middle"
                                                        className="axis-label"
                                                    >
                                                        Treatment Day
                                                    </text>

                                                    {/* Y-axis ticks and labels */}
                                                    {getDurationChartData().tickValues.map(tick => (
                                                        <g key={tick}>
                                                            <line
                                                                x1={getDurationChartData().padding.left - 5}
                                                                y1={getDurationChartData().scaleY(tick)}
                                                                x2={getDurationChartData().padding.left}
                                                                y2={getDurationChartData().scaleY(tick)}
                                                                stroke="#d0d0d0"
                                                                strokeWidth="1.5"
                                                            />
                                                            <text
                                                                x={getDurationChartData().padding.left - 10}
                                                                y={getDurationChartData().scaleY(tick)}
                                                                textAnchor="end"
                                                                alignmentBaseline="middle"
                                                                fill="#555555"
                                                                fontSize="11px"
                                                                fontWeight="500"
                                                            >
                                                                {Math.round(tick / 60)} min
                                                            </text>
                                                        </g>
                                                    ))}

                                                    {/* Data line */}
                                                    <path
                                                        d={getDurationChartData().data.map((dayData, i) => {
                                                            if (dayData.totalDuration === null || typeof dayData.totalDuration !== 'number') return "";
                                                            const x = getDurationChartData().scaleX(i);
                                                            const y = getDurationChartData().scaleY(dayData.totalDuration);
                                                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                                        }).join(' ')}
                                                        stroke="#0066cc"
                                                        strokeWidth="2.5"
                                                        fill="none"
                                                    />

                                                    {/* Data points */}
                                                    {getDurationChartData().data.map((dayData, i) => {
                                                        if (dayData.totalDuration === null || typeof dayData.totalDuration !== 'number') return null;
                                                        const x = getDurationChartData().scaleX(i);
                                                        return (
                                                            <circle
                                                                key={dayData.date}
                                                                cx={x}
                                                                cy={getDurationChartData().scaleY(dayData.totalDuration)}
                                                                r="5"
                                                                fill="#0066cc"
                                                                stroke="white"
                                                                strokeWidth="1.5"
                                                                className="data-point"
                                                            >
                                                                <title>
                                                                    {`Total Duration: ${Math.round(dayData.totalDuration / 60)} minutes`}
                                                                </title>
                                                            </circle>
                                                        );
                                                    })}
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="session-table">
                                <h3>{patientName}'s Sessions</h3>
                                {Object.entries(patientData)
                                    .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
                                    .map(([date, sessions]) => (
                                        <div key={date} className="date-section">
                                            <h2>{(() => {
                                                try {
                                                    const [year, month, day] = date.split('-').map(Number);
                                                    const dateObj = new Date(year, month - 1, day);
                                                    if (isNaN(dateObj.getTime())) throw new Error('Invalid date');
                                                    return dateObj.toLocaleDateString('en-US', {
                                                        weekday: 'long',
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    });
                                                } catch (e) {
                                                    console.error('Error formatting date:', date, e);
                                                    return date;
                                                }
                                            })()}</h2>
                                            <div className="measurements-table-wrapper">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>Time</th>
                                                            <th>Duration</th>
                                                            <th>Reps</th>
                                                            <th>Angle</th>
                                                            <th>Goal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sessions
                                                            .sort((a, b) => {
                                                                const timeA = a.session_time || '00:00:00';
                                                                const timeB = b.session_time || '00:00:00';
                                                                return timeA.localeCompare(timeB);
                                                            })
                                                            .map((session, index) => (
                                                                <tr key={`${date}-${index}`}>
                                                                    <td>
                                                                        {session.session_time
                                                                            ? formatTime(session.session_time)
                                                                            : 'N/A'}
                                                                    </td>
                                                                    <td>{session.duration} s</td>
                                                                    <td>{session.reps}</td>
                                                                    <td className="angle-cell">
                                                                        <div className="angle-display">
                                                                            <span>
                                                                                {Number(session.max_angle).toFixed(1)}°
                                                                            </span>
                                                                            <div
                                                                                className="angle-bar"
                                                                                style={{
                                                                                    width: `${Math.min(
                                                                                        100,
                                                                                        (session.max_angle / 90) * 100
                                                                                    )}%`,
                                                                                    background:
                                                                                        session.max_angle >=
                                                                                            (session.angle_goal || 0)
                                                                                            ? 'var(--success-500)'
                                                                                            : 'var(--primary-500)'
                                                                                }}
                                                                            ></div>
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        {session.angle_goal
                                                                            ? Number(session.angle_goal).toFixed(1) + '°'
                                                                            : 'N/A'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
            {isModalOpen && (
                <AdjustPlanModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveChanges}
                    currentPlan={currentTreatmentPlan}
                />
            )}
        </>
    );
};

export default PatientDetail;
