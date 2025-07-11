import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDoctorAuth } from "../utils/auth";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const doctorData = getDoctorAuth();
    if (doctorData) {
      navigate("/doctor-dashboard");
    }
  }, [navigate]);

  return (
    <div className="landing-container">
      <div className="landing-content">
        <img
          src="/MotionMendTransparent.png"
          alt="MotionMend Logo"
          className="landing-logo"
        />
        <h1>Welcome to MotionMend</h1>
        <p className="subtitle">Personalized, Secure, and Portable Rehab Companion.</p>
        <div className="button-group">
          <Link to="/doctor-login" className="landing-button doctor">
            Doctor Login
          </Link>
          <Link to="/doctor-register" className="landing-button register">
            Register as Doctor
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
