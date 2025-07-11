import React, { createContext, useState, useContext } from "react";

const DoctorContext = createContext();

export const useDoctor = () => useContext(DoctorContext);

export const DoctorProvider = ({ children }) => {
    const [doctorId, setDoctorId] = useState(null);
    const [doctorName, setDoctorName] = useState(""); // Add doctorName state
    const [currentPatientId, setCurrentPatientId] = useState(null);

    const setDoctor = (id, name) => {
        setDoctorId(id);
        setDoctorName(name); // Update doctorName
    };

    const clearDoctor = () => {
        setDoctorId(null);
        setDoctorName("");
    };

    const setCurrentPatient = (id) => {
        setCurrentPatientId(id);
    };

    return (
        <DoctorContext.Provider value={{
            doctorId,
            doctorName,
            currentPatientId,
            setDoctor,
            clearDoctor,
            setCurrentPatient
        }}>
            {children}
        </DoctorContext.Provider>
    );
};
