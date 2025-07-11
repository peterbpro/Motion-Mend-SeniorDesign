import React, { useState, useEffect } from "react";
import PatientCard from "../Components/PatientCard";
import { useNavigate, Link } from "react-router-dom";
import { getDoctorAuth, clearDoctorAuth } from '../utils/auth';
import config from "../../config.json";
import "./DoctorDashboard.css";
import Header from '../Components/Header';

function DoctorDashboard() {
    const [patients, setPatients] = useState([]);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const doctorData = getDoctorAuth();

        if (!doctorData) {
            navigate("/doctor-login");
            return;
        }

        const fetchPatients = async () => {
            try {
                setIsLoading(true);
                const response = await fetch(
                    `http://${config.server_host}:${config.server_port}/patient_overview/${doctorData.id}`
                );
                if (!response.ok) {
                    throw new Error("Failed to fetch patients");
                }
                const data = await response.json();

                const patientsArray = Array.isArray(data) ? data : [];
                setPatients(patientsArray);
            } catch (error) {
                console.error("Error fetching patients:", error);
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    setError("Unable to connect to server. Please check your connection and try again.");
                } else {
                    setError("Failed to load patients. Please try again later.");
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchPatients();
    }, []); // Empty dependencies array since we get doctorData inside useEffect

    // Filter patients by search term
    const filteredPatients = patients.filter(patient =>
        patient.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleLogout = () => {
        clearDoctorAuth();
        navigate("/");
    };

    return (
        <>
            <Header showWelcome={true} />
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <div className="dashboard-header-section">
                        <div className="dashboard-actions">
                            <Link to="/add-patient" className="dashboard-action-button">
                                <span className="icon">➕</span>
                                <span>Add Patient</span>
                            </Link>
                            <button onClick={handleLogout} className="dashboard-action-button logout">
                                <span className="icon">🚪</span>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>

                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon">👥</div>
                            <h3>Patients Under Your Care</h3>
                            <div className="stat-value-small">
                                {patients.length}
                            </div>
                            <p className="stat-description">Manage them all here</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon">📅</div>
                            <h3>Recent Activity</h3>
                            <div className="stat-value-small">
                                {patients.length > 0
                                    ? (() => {
                                        const latestPatient = patients
                                            .filter(p => p.last_update && p.last_update !== 'null')
                                            .sort((a, b) => new Date(b.last_update) - new Date(a.last_update))[0];

                                        if (latestPatient) {
                                            try {
                                                const date = new Date(latestPatient.last_update);
                                                return date.toLocaleDateString();
                                            } catch (e) {
                                                return 'Recently';
                                            }
                                        }
                                        return 'No recent activity';
                                    })()
                                    : 'No recent activity'}
                            </div>
                            <p className="stat-description">Latest patient update</p>
                        </div>
                    </div>

                    <div className="patients-section">
                        <div className="patients-header">
                            <h2>Your Patients</h2>
                            <div className="search-container">
                                <input
                                    type="text"
                                    placeholder="Search patients..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="search-input"
                                />
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="loading-message">Loading patients...</div>
                        ) : error ? (
                            <div className="error-message">
                                <i className="fas fa-exclamation-circle"></i>
                                {error}
                            </div>
                        ) : (
                            <div className="patient-grid">
                                {filteredPatients.length > 0 ? (
                                    filteredPatients.map((patient) => (
                                        <PatientCard
                                            key={patient.id}
                                            patient={patient}
                                            className="animate-in"
                                        />
                                    ))
                                ) : (
                                    <div className="no-patients">
                                        {searchTerm ? (
                                            <p>No patients found matching your search.</p>
                                        ) : (
                                            <p>No patients found.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default DoctorDashboard;
