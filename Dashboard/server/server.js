/**
 * Main server file
 */

const express = require('express');
const cors = require('cors');
const config = require('./config.json');
const routes = require('./routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Register routes
app.post('/create_doctor', routes.create_doctor);
app.post('/create_patient', routes.create_patient);

// Authentication routes
app.post('/doctor_login', routes.doctor_login);

// Patient-specific routes
app.get('/patient/:patient_id', routes.patient);
app.get('/patient_overview/:doctor_id', routes.patient_overview);
app.get('/patient_data/:id', routes.patient_data);

// Route to adjust treatment plan
app.put('/adjust_treatment_plan/:patient_id', routes.adjust_treatment_plan);

// Route to get treatment plan
app.get('/treatment_plan/:patient_id', routes.get_treatment_plan);

// Utility routes
app.get('/get_all_doctors', routes.get_all_doctors);

// Search functionality
app.get('/search-patients/:doctor_id', routes.search_patients);

// Start HTTP server
app.listen(config.server_port, () => {
    console.log(`Server running at http://${config.server_host}:${config.server_port}/`);
});

module.exports = app;