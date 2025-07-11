import React from "react";
import { useNavigate } from "react-router-dom";
import { useDoctor } from "../DoctorContext";
import "./PatientCard.css"; // Optional: Specific styles for the cards

const PatientCard = ({ patient }) => {
    const navigate = useNavigate();
    const { setCurrentPatient } = useDoctor();

    const toTitleCase = (str) => {
        return str.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    const handleClick = (e) => {
        e.preventDefault();
        setCurrentPatient(patient.id);
        navigate('/patient-profile');
    }

    return (
        <div className="patient-card" onClick={handleClick}>
            <div className="patient-card-content">
                <h3>{toTitleCase(patient.name)}</h3>
                <p className="username">Username: {patient.username}</p>
                {/* <p>Age: {patient.age}</p>
                <p>Last Visit: {patient.last_visit}</p> */}
            </div>
        </div>
    );
};

export default PatientCard;
