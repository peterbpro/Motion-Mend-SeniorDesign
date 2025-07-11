import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Login.css";
import config from '../../config.json';
import Header from "../Components/Header";

const DoctorRegister = () => {
    const [formData, setFormData] = useState({
        name: "",
        username: "",
        password: "",
        confirmPassword: ""
    });
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.id]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // Validate form
        if (!formData.name || !formData.username || !formData.password || !formData.confirmPassword) {
            setError("Please fill out all fields");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        try {
            const response = await fetch(`http://${config.server_host}:${config.server_port}/create_doctor`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: formData.name,
                    username: formData.username,
                    password: formData.password
                }),
            });

            if (response.ok) {
                navigate("/doctor-login", { state: { message: "Registration successful! Please login." } });
            } else {
                const errorData = await response.json();
                setError(errorData.error || "Registration failed");
            }
        } catch (error) {
            console.error("Error registering:", error);
            setError("Unable to connect to the server. Please try again later.");
        }
    };

    return (
        <>
            <Header />
            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <h1>Doctor Registration</h1>
                        <p>Create your account to get started.</p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="form-group">
                            <label htmlFor="name">Full Name</label>
                            <input
                                type="text"
                                id="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Enter your full name"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <input
                                type="text"
                                id="username"
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="Choose a username"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Choose a password"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Confirm your password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="submit-button"
                            disabled={!formData.name || !formData.username || !formData.password || !formData.confirmPassword}
                        >
                            Register
                        </button>
                    </form>

                    <Link to="/doctor-login" className="back-link">
                        Already have an account? Login here
                    </Link>
                </div>
            </div>
        </>
    );
};

export default DoctorRegister; 