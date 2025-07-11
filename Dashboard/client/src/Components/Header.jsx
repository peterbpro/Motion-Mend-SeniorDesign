import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getDoctorAuth, clearDoctorAuth } from '../utils/auth';
import './Header.css';

const Header = ({ showWelcome = false }) => {
    const navigate = useNavigate();
    const doctorData = getDoctorAuth();

    const handleLogout = () => {
        clearDoctorAuth();
        navigate('/');
    };

    return (
        <div className="header-container">
            <div className="header-content">
                <Link to="/doctor-dashboard" className="header-logo-link">
                    <div className="header-logo">
                        <img
                            src="/MotionMendTransparent.png"
                            alt="MotionMend Logo"
                            className="logo-image"
                        />
                    </div>
                </Link>
                <div className="header-right">
                    {showWelcome && doctorData && (
                        <h1 className="welcome-text">Welcome, Dr. {doctorData.name}</h1>
                    )}
                    {showWelcome && (
                        <button onClick={handleLogout} className="logout-button">
                            Logout
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Header; 