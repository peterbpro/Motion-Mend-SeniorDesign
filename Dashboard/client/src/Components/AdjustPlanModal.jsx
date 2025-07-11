import React, { useState, useEffect, useCallback } from 'react';
import './AdjustPlanModal.css'; // We'll create this CSS file next
import config from '../../config.json';
import { useDoctor } from '../DoctorContext';

const AdjustPlanModal = ({ onClose, onSave }) => {
    const { currentPatientId } = useDoctor();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [dailyGoals, setDailyGoals] = useState([]);
    const [holdTime, setHoldTime] = useState(10); // Default hold time

    // Fetch current plan when modal opens
    const fetchPlan = useCallback(async () => {
        if (!currentPatientId) {
            setError('No patient selected');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError('');
        console.log(`Fetching plan for patientId: ${currentPatientId}`);
        try {
            const response = await fetch(`http://${config.server_host}:${config.server_port}/treatment_plan/${currentPatientId}`);
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`Fetch plan failed with status ${response.status}:`, errorBody);
                throw new Error('Failed to fetch treatment plan');
            }
            const planData = await response.json();
            console.log("Raw treatment plan data from database:", planData);

            if (planData && planData.length > 0) {
                // Ensure mapped values are numbers
                const mappedGoals = planData.map(day => Number(day.angle_goal || 0));
                console.log("Mapped daily goals:", mappedGoals);
                setDailyGoals(mappedGoals);
                const holdTimeValue = Number(planData[0].hold_time || 10);
                console.log("Hold time value:", holdTimeValue);
                setHoldTime(holdTimeValue);
            } else {
                // If no plan exists, start with a default (e.g., 14 days, 45 deg, 10s)
                console.log("No existing plan found, starting with default values");
                setDailyGoals(Array(14).fill(45));
                setHoldTime(10);
            }
        } catch (err) {
            console.error("Error fetching plan:", err);
            setError('Failed to load current plan. Please try again.');
            setDailyGoals([]); // Clear goals on error
        } finally {
            setIsLoading(false);
        }
    }, [currentPatientId]);

    useEffect(() => {
        fetchPlan();
    }, [fetchPlan]);

    // Add useEffect to log dailyGoals state changes
    useEffect(() => {
        console.log("Daily goals state updated:", dailyGoals);
    }, [dailyGoals]);

    const handleGoalChange = (index, value) => {
        const newGoals = [...dailyGoals];
        // Ensure angle is between 0 and 90
        const angle = Math.max(0, Math.min(90, parseInt(value) || 0));
        newGoals[index] = angle;
        setDailyGoals(newGoals);
    };

    const handleHoldTimeChange = (value) => {
        setHoldTime(Math.max(1, parseInt(value) || 1)); // Ensure hold time is at least 1
    };

    const addWeek = () => {
        const lastGoal = dailyGoals.length > 0 ? dailyGoals[dailyGoals.length - 1] : 45;
        const newWeekGoals = Array(7).fill(0).map((_, i) => Math.min(90, lastGoal + (i + 1) * 2));
        setDailyGoals([...dailyGoals, ...newWeekGoals]);
    };

    const handleSave = async () => {
        if (!currentPatientId) {
            setError('No patient selected');
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            const response = await fetch(`http://${config.server_host}:${config.server_port}/adjust_treatment_plan/${currentPatientId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ dailyGoals: dailyGoals, holdTime: holdTime }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to save adjustments');
            }

            if (onSave) {
                onSave();
            }
            onClose();
        } catch (err) {
            console.error("Error adjusting plan:", err);
            setError('Failed to save adjustments. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>Adjust Treatment Plan</h2>
                {error && <p className="error-message">{error}</p>}

                {isLoading ? (
                    <p>Loading current plan...</p>
                ) : (
                    <>
                        <div className="form-group hold-time-group">
                            <label htmlFor="holdTime">Hold Time (seconds):</label>
                            <input
                                type="number"
                                id="holdTime"
                                value={holdTime}
                                onChange={(e) => handleHoldTimeChange(e.target.value)}
                                min="1"
                                className="hold-time-input"
                            />
                        </div>

                        <div className="daily-goals-editor">
                            <h3>Daily Angle Goals (°):</h3>
                            <div className="goals-grid">
                                {dailyGoals.map((goal, index) => (
                                    <div key={index} className="goal-input-item">
                                        <label htmlFor={`day-${index + 1}`}>Day {index + 1}</label>
                                        <input
                                            type="number"
                                            id={`day-${index + 1}`}
                                            value={goal}
                                            onChange={(e) => handleGoalChange(index, e.target.value)}
                                            min="0"
                                            max="90"
                                        />
                                    </div>
                                ))}
                            </div>
                            <button onClick={addWeek} className="button-add-week" disabled={isSaving}>
                                + Add Week
                            </button>
                        </div>

                        <div className="modal-actions">
                            <button onClick={onClose} disabled={isSaving} className="button-secondary">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={isSaving || isLoading} className="button-primary">
                                {isSaving ? 'Saving...' : 'Save Adjustments'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdjustPlanModal; 