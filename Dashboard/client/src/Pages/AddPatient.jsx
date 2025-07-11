import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getDoctorAuth } from "../utils/auth";
import Header from "../Components/Header";
import config from "../../config.json";
import "./AddPatient.css";

const AddPatient = () => {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [credentials, setCredentials] = useState(null);
    const [successMessage, setSuccessMessage] = useState("");
    const navigate = useNavigate();
    const doctorData = getDoctorAuth();

    // Track which angle values have been manually edited
    const editedAngles = useRef(new Set());

    // Track if this is the first render
    const isFirstRender = useRef(true);

    useEffect(() => {
        // If not logged in, redirect
        if (!doctorData) {
            navigate("/doctor-login");
        }
    }, [doctorData, navigate]);

    // Patient state
    const [patient, setPatient] = useState({
        name: "",
        treatmentPlan: {
            initialAngleGoal: 45,
            initialHoldTime: 10,
            dailyAngles: Array(14).fill(45).map((val, i) => Math.min(val + (i * 2), 90)),
        },
    });

    // Update daily angles when initialAngleGoal changes, but preserve manually edited values
    useEffect(() => {
        // Skip on first render since values are already initialized
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        setPatient((prev) => {
            // Create a new array of angles based on the new initialAngleGoal
            const newDailyAngles = prev.treatmentPlan.dailyAngles.map((angle, idx) => {
                // If this angle was manually edited, preserve its value
                if (editedAngles.current.has(idx)) {
                    return angle;
                }
                // Otherwise, calculate the default value
                return Math.min(patient.treatmentPlan.initialAngleGoal + (idx * 2), 90);
            });

            return {
                ...prev,
                treatmentPlan: {
                    ...prev.treatmentPlan,
                    dailyAngles: newDailyAngles
                }
            };
        });
    }, [patient.treatmentPlan.initialAngleGoal]);

    // Handle input changes
    const handleChange = (e) => {
        const { name, value } = e.target;

        // If "treatment.*"
        if (name.startsWith("treatment.")) {
            const field = name.split(".")[1];
            setPatient((prev) => ({
                ...prev,
                treatmentPlan: {
                    ...prev.treatmentPlan,
                    [field]: Number(value),
                },
            }));
        }
        // If "angle.{index}"
        else if (name.startsWith("angle.")) {
            const idx = parseInt(name.split(".")[1], 10);
            const angleVal = Math.min(Math.max(0, Number(value)), 90);

            // Mark this angle as manually edited
            editedAngles.current.add(idx);

            setPatient((prev) => {
                const updatedAngles = [...prev.treatmentPlan.dailyAngles];
                updatedAngles[idx] = angleVal;

                return {
                    ...prev,
                    treatmentPlan: {
                        ...prev.treatmentPlan,
                        dailyAngles: updatedAngles
                    },
                };
            });
        }
        // Otherwise top-level "patient"
        else {
            setPatient((prev) => ({ ...prev, [name]: value }));
        }
    };

    // Move from Step 1 → Step 2
    const handleNext = () => {
        if (patient.name.trim()) {
            setStep(2);
        }
    };

    // Final form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (step === 1) {
            handleNext();
            return;
        }

        setIsSubmitting(true);
        try {
            const treatmentPlanData = {
                initialAngleGoal: patient.treatmentPlan.initialAngleGoal,
                initialHoldTime: patient.treatmentPlan.initialHoldTime,
                dailyAngles: patient.treatmentPlan.dailyAngles,
            };

            const response = await fetch(
                `http://${config.server_host}:${config.server_port}/create_patient`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: patient.name,
                        doctorId: doctorData.id,
                        treatmentPlan: treatmentPlanData,
                    }),
                }
            );

            const data = await response.json();
            if (data.success) {
                setCredentials(data.credentials);
                setSuccessMessage(`Patient ${patient.name} has been successfully added!`);
            } else {
                throw new Error(data.error || "Failed to create patient");
            }
        } catch (err) {
            console.error("Error:", err);
            alert("Failed to create patient");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Header />
            <div className="add-patient-page">
                <div className="onboarding-container">
                    {/* Back button positioned outside the card via CSS */}
                    <button
                        onClick={() => navigate("/doctor-dashboard")}
                        className="back-button"
                    >
                        ← Back to Dashboard
                    </button>

                    {/* Top row with only step labels now */}
                    <div className="top-row">
                        <div className="step-labels">
                            <span className={step === 1 ? "active" : ""}>1. Patient Info</span>
                            <span className={step === 2 ? "active" : ""}>2. Treatment Plan</span>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="progress-bar">
                        <div
                            className="progress"
                            style={{ width: `${(step / 2) * 100}%` }}
                        ></div>
                    </div>

                    {/* Success message and credentials */}
                    {successMessage && (
                        <div className="success-message">
                            <i className="fas fa-check-circle"></i>
                            {successMessage}
                            <p className="redirect-message">
                                You can now return to the dashboard using the "Return to Dashboard" button or the MotionMend logo.
                            </p>
                        </div>
                    )}

                    {credentials ? (
                        <div className="credentials-card">
                            <h2>Patient Account Created!</h2>
                            <p>Please provide these login credentials to your patient:</p>
                            <div className="credentials-info">
                                <p>
                                    <strong>Username:</strong> {credentials.username}
                                </p>
                                <p>
                                    <strong>Password:</strong> {credentials.password}
                                </p>
                            </div>
                            <p className="credentials-note">
                                Please share these credentials securely with your patient.
                            </p>
                            <div className="button-group">
                                <button
                                    onClick={() => navigate('/doctor-dashboard')}
                                    className="return-dashboard-button"
                                >
                                    Return to Dashboard
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {step === 1 && (
                                <div className="step-content animate-slide-up">
                                    <h2>Patient Information</h2>
                                    <div className="form-group">
                                        <label>Patient Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={patient.name}
                                            onChange={handleChange}
                                            required
                                            placeholder="Enter patient's full name"
                                        />
                                    </div>
                                    <button type="submit" className="next-button">
                                        Next
                                    </button>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="step-content animate-slide-up">
                                    <h2>Initial Treatment Plan</h2>
                                    <div className="form-group">
                                        <label>Starting Angle (degrees)</label>
                                        <div className="input-with-hint">
                                            <input
                                                type="number"
                                                name="treatment.initialAngleGoal"
                                                value={patient.treatmentPlan.initialAngleGoal}
                                                onChange={handleChange}
                                                min="0"
                                                max="90"
                                                required
                                            />
                                            <span className="input-hint">Max: 90°</span>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Hold Time (seconds)</label>
                                        <input
                                            type="number"
                                            name="treatment.initialHoldTime"
                                            value={patient.treatmentPlan.initialHoldTime}
                                            onChange={handleChange}
                                            min="1"
                                            required
                                        />
                                    </div>

                                    <div className="daily-angles-grid">
                                        <h3>Daily Angle Goals</h3>
                                        <p className="hint">
                                            Default progression adds 2° per day. Adjust if needed.
                                        </p>
                                        <div className="angles-container">
                                            {patient.treatmentPlan.dailyAngles.map((angle, idx) => (
                                                <div key={idx} className="daily-angle-input">
                                                    <label>Day {idx + 1}</label>
                                                    <input
                                                        type="number"
                                                        name={`angle.${idx}`}
                                                        value={angle}
                                                        onChange={handleChange}
                                                        min="0"
                                                        max="90"
                                                        required
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="button-group">
                                        <button
                                            type="button"
                                            onClick={() => setStep(1)}
                                            className="prev-button"
                                        >
                                            Back
                                        </button>
                                        <button
                                            type="submit"
                                            className="submit-button"
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? "Creating..." : "Add Patient"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    )}
                </div>
            </div>
        </>
    );
};

export default AddPatient;
