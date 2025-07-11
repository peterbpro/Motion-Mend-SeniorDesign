import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./Pages/LandingPage";
import DoctorLogin from "./Pages/DoctorLogin";
import DoctorDashboard from "./Pages/DoctorDashboard";
import PatientDetail from "./Pages/PatientDetail";
import AddPatient from "./Pages/AddPatient";
import AnalyticsDashboard from "./Pages/AnalyticsDashboard";
import DoctorRegister from "./Pages/DoctorRegister";
import { DoctorProvider } from "./DoctorContext";
import "./App.css";

function App() {
    return (
        <DoctorProvider>
            <Router>
                <div className="app-container">
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/doctor-login" element={<DoctorLogin />} />
                        <Route path="/doctor-register" element={<DoctorRegister />} />
                        <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
                        <Route path="/patient/:id" element={<PatientDetail />} />
                        <Route path="/patient-profile" element={<PatientDetail />} />
                        <Route path="/add-patient" element={<AddPatient />} />
                        <Route path="/analytics" element={<AnalyticsDashboard />} />
                    </Routes>
                </div>
            </Router>
        </DoctorProvider>
    );
}

export default App;
