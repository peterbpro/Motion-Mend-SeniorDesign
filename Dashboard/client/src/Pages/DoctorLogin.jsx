import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Login.css";
import config from '../../config.json';
import { setDoctorAuth } from '../utils/auth';
import Header from "../Components/Header.jsx";

const DoctorLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please fill out all fields");
      return;
    }

    console.log("Logging in with:", username, password);

    try {
      const response = await fetch(`http://${config.server_host}:${config.server_port}/doctor_login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setDoctorAuth({
          id: data.id,
          name: data.name,
          username: data.username
        });
        navigate("/doctor-dashboard");
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      console.error("Error logging in:", err);
      setError("Failed to connect to server");
    }
  };

  return (
    <>
      <Header />
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>Doctor Login</h1>
            <p>Welcome back! Please enter your credentials.</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={!username || !password}
            >
              Login
            </button>
          </form>

          <Link to="/" className="back-link">
            ← Back to home
          </Link>
        </div>
      </div>
    </>
  );
};

export default DoctorLogin;
