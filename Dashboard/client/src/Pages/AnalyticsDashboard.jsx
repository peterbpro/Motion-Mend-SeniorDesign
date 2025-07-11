import React from "react";
import { useDoctor } from "../DoctorContext";
import { Link } from "react-router-dom";
import "./AnalyticsDashboard.css";
import Header from '../Components/Header';

const AnalyticsDashboard = () => {
    const { doctorName } = useDoctor();

    return (
        <>
            <Header />
            <div className="analytics-container">
                <div className="analytics-header">
                    <h1>Analytics Dashboard</h1>
                    <Link to="/doctor-dashboard" className="back-button">
                        ← Back to Dashboard
                    </Link>
                </div>

                <div className="chart-grid">
                    <div className="chart-card">
                        <h3>Patient Progress Overview</h3>
                        <div className="chart-placeholder">
                            <div className="chart-bar" style={{ height: '60%' }}></div>
                            <div className="chart-bar" style={{ height: '75%' }}></div>
                            <div className="chart-bar" style={{ height: '40%' }}></div>
                            <div className="chart-bar" style={{ height: '85%' }}></div>
                            <div className="chart-bar" style={{ height: '65%' }}></div>
                        </div>
                    </div>

                    <div className="chart-card">
                        <h3>Treatment Effectiveness</h3>
                        <div className="chart-placeholder circular">
                            <div className="donut-chart">
                                <div className="donut-segment" style={{ transform: 'rotate(0deg)', background: 'var(--primary-500)' }}></div>
                                <div className="donut-segment" style={{ transform: 'rotate(120deg)', background: 'var(--primary-300)' }}></div>
                                <div className="donut-segment" style={{ transform: 'rotate(240deg)', background: 'var(--primary-100)' }}></div>
                                <div className="donut-center"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AnalyticsDashboard;
