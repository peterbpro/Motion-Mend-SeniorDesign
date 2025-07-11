/**
 * This file contains all the routes for the server
 */

const mysql = require('mysql');
const config = require('./config.json');

/**
 * Establish connection to database
 */
const connection = mysql.createConnection({
    host: config.rds_host,
    user: config.rds_user,
    password: config.rds_password,
    port: config.rds_port,
    database: config.rds_db
});
connection.connect((err) => err && console.log(err));

/**
 * Route to create a new doctor account
 */
const create_doctor = (req, res) => {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    // First check if username already exists
    const checkQuery = `
    SELECT username 
    FROM doctors 
    WHERE username = ?
    `;

    connection.query(checkQuery, [username], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Error checking username availability' });
            return;
        }

        if (results.length > 0) {
            res.status(400).json({ error: 'Username already exists' });
            return;
        }

        // If username is available, create the account
        const insertQuery = `
        INSERT INTO doctors (name, username, password)
        VALUES (?, ?, ?)
        `;

        connection.query(insertQuery, [name, username, password], (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Error creating doctor account' });
            } else {
                res.status(201).json({ message: 'Doctor account created successfully' });
            }
        });
    });
};

/**
 * Route to create a new patient account
 */
const create_patient = async (req, res) => {
    const { name, doctorId, treatmentPlan } = req.body;
    const { initialHoldTime, dailyAngles } = treatmentPlan;

    if (!name || !doctorId || !dailyAngles || !Array.isArray(dailyAngles)) {
        return res.status(400).json({ error: 'Missing required fields or invalid data format' });
    }

    // Generate base username
    let baseUsername = name.toLowerCase().replace(/\s+/g, '.');

    // Function to generate a random number between min and max (inclusive)
    const getRandomNumber = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    // Function to generate password
    const generatePassword = () => Math.random().toString(36).slice(-8);

    // Function to check if username exists
    const checkUsername = (username) => {
        return new Promise((resolve, reject) => {
            connection.query(
                'SELECT username FROM patients WHERE username = ?',
                [username],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results.length > 0);
                }
            );
        });
    };

    // Function to generate unique username
    const generateUniqueUsername = async (baseUsername) => {
        let username = baseUsername;
        let exists = await checkUsername(username);

        while (exists) {
            // Add random 3-digit number
            const suffix = getRandomNumber(100, 999);
            username = `${baseUsername}.${suffix}`;
            exists = await checkUsername(username);
        }

        return username;
    };

    try {
        const username = await generateUniqueUsername(baseUsername);
        const password = generatePassword();

        connection.beginTransaction(err => {
            if (err) {
                console.error('Transaction error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            // Insert patient with credentials
            connection.query(
                'INSERT INTO patients (doctor_id, name, username, password) VALUES (?, ?, ?, ?)',
                [doctorId, name, username, password],
                (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            console.error('Patient creation error:', err);
                            res.status(500).json({ error: 'Error creating patient' });
                        });
                    }

                    // Create treatment plan values using the provided daily angles
                    const treatmentPlanValues = dailyAngles.map((angle, index) => [
                        result.insertId,
                        index + 1,
                        angle,
                        initialHoldTime
                    ]);

                    connection.query(
                        'INSERT INTO treatment_plans (patient_id, day, angle_goal, hold_time) VALUES ?',
                        [treatmentPlanValues],
                        err => {
                            if (err) {
                                return connection.rollback(() => {
                                    console.error('Treatment plan error:', err);
                                    res.status(500).json({ error: 'Error creating treatment plan' });
                                });
                            }

                            connection.commit(err => {
                                if (err) {
                                    return connection.rollback(() => {
                                        console.error('Commit error:', err);
                                        res.status(500).json({ error: 'Error creating patient' });
                                    });
                                }
                                res.status(201).json({
                                    success: true,
                                    message: 'Patient created successfully',
                                    credentials: {
                                        username,
                                        password
                                    }
                                });
                            });
                        }
                    );
                }
            );
        });
    } catch (error) {
        console.error('Error generating unique username:', error);
        res.status(500).json({ error: 'Error creating patient account' });
    }
};

/**
 * Route to login a doctor
 */
const doctor_login = (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).send('Missing required fields');
        return;
    }

    const qry = `
    SELECT id, name, username
    FROM doctors
    WHERE username = ? AND password = ?
    `;

    connection.query(qry, [username, password], (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        } else if (data.length === 0) {
            res.status(401).json({ error: 'Invalid username or password' });
        } else {
            res.status(200).json(data[0]);
        }
    });
};

/**
 * Returns all patients or a specific one that a given doctor has
 */
const search_patients = async function (req, res) {
    const doctor_id = req.params;
    const name = req.query.patient_name || '';

    if (!doctor_id) {
        res.status(400).send('Missing required doctor_id');
        return;
    }

    let qry = `
    SELECT *
    FROM patient_data
    WHERE doctor_id = ?
    `;

    const params = [doctor_id];

    if (name !== '') {
        qry += ` AND name LIKE ?`;
        params.push(`%${name}%`);
    }

    connection.query(qry, params, (err, data) => {
        if (err || data.length === 0) {
            console.error(err);
            res.status(500).send('Error fetching patients');
        } else {
            res.status(200).json(data);
        }
    });
};

/**
 * Returns all data for a specific patient given their ID
 */
const patient = (req, res) => {
    const patient_id = req.params.patient_id;

    if (!patient_id) {
        res.status(400).send('Missing required patient_id');
        return;
    }

    const qry = `
    SELECT name, doctor_id
    FROM patients
    WHERE id = ?
    `;

    connection.query(qry, [patient_id], (err, data) => {
        if (err || data.length === 0) {
            console.error(err);
            res.status(404).send('Patient not found');
        } else {
            res.status(200).json(data[0]);
        }
    });
};

/**
 * Route to get all patient data for a given doctor
 */
const patient_overview = (req, res) => {
    const { doctor_id } = req.params;

    if (!doctor_id) {
        res.status(400).send('Missing required doctor_id');
        return;
    }

    const qry = `
    SELECT DISTINCT p.id, p.name, p.username,
        (SELECT COUNT(*) 
         FROM patient_data pd 
         WHERE pd.patient_id = p.id) as measurement_count,
        (SELECT MAX(start_day)
         FROM patient_data pd
         WHERE pd.patient_id = p.id) as last_update
    FROM patients p
    WHERE p.doctor_id = ?
    `;

    connection.query(qry, [doctor_id], (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching patient data');
        } else {
            res.status(200).json(data);
        }
    });
};

/**
 * Route to get all doctors
 */
const get_all_doctors = (req, res) => {
    const qry = `
    SELECT id, name
    FROM doctors
    `;

    connection.query(qry, (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching doctors');
        } else {
            res.status(200).json(data);
        }
    });
};

/**
 * Route to get all patient data for a given patient
 */
const patient_data = (req, res) => {
    const { id } = req.params;

    const qry = `
        SELECT 
            p.name,
            pd.start_day as date,
            pd.session_id,
            pd.session_duration,
            pd.num_reps,
            pd.max_angle_achieved,
            pd.session_time,
            (
                SELECT angle_goal 
                FROM treatment_plans tp 
                WHERE tp.patient_id = pd.patient_id 
                AND tp.day = (
                    SELECT COUNT(DISTINCT pd2.start_day)
                    FROM patient_data pd2
                    WHERE pd2.patient_id = pd.patient_id
                    AND pd2.start_day <= pd.start_day
                )
            ) as angle_goal
        FROM patients p
        LEFT JOIN patient_data pd ON pd.patient_id = p.id
        WHERE p.id = ?
        ORDER BY pd.start_day ASC, pd.session_time ASC;
    `;

    connection.query(qry, [id], (err, data) => {
        if (err) {
            console.error(`Error fetching patient data for patient_id: ${id}`, err);
            res.status(500).send("Internal server error while fetching patient data.");
        } else {
            // Get the patient name even if there's no exercise data
            const nameQuery = `SELECT name FROM patients WHERE id = ?`;
            connection.query(nameQuery, [id], (nameErr, nameData) => {
                if (nameErr || nameData.length === 0) {
                    res.status(404).send("Patient not found.");
                    return;
                }

                // Return patient name with empty data if no exercise data exists
                if (data.length === 0) {
                    res.status(200).json({
                        name: nameData[0].name,
                        data: {}
                    });
                    return;
                }

                // Group data by date if exercise data exists
                const groupedData = data.reduce((acc, record) => {
                    if (!record.date) return acc; // Skip if no date (from LEFT JOIN)

                    // Use local timezone instead of UTC
                    const date = new Date(record.date);
                    const localDate = date.getFullYear() + '-' +
                        String(date.getMonth() + 1).padStart(2, '0') + '-' +
                        String(date.getDate()).padStart(2, '0');

                    if (!acc[localDate]) {
                        acc[localDate] = [];
                    }
                    acc[localDate].push({
                        session_id: record.session_id,
                        duration: record.session_duration,
                        reps: record.num_reps,
                        max_angle: record.max_angle_achieved,
                        angle_goal: record.angle_goal,
                        session_time: record.session_time
                    });
                    return acc;
                }, {});

                res.status(200).json({
                    name: nameData[0].name,
                    data: groupedData
                });
            });
        }
    });
};

/**
 * Route to adjust (extend) a patient's treatment plan
 */
const adjust_treatment_plan = async (req, res) => {
    const { patient_id } = req.params;
    const { dailyGoals, holdTime } = req.body; // Expect full plan and hold time

    if (!patient_id || !Array.isArray(dailyGoals) || typeof holdTime === 'undefined' || isNaN(parseInt(holdTime))) {
        return res.status(400).json({ error: 'Missing required fields or invalid data' });
    }

    connection.beginTransaction(async (err) => {
        if (err) {
            console.error('Transaction start error:', err);
            return res.status(500).json({ error: 'Database transaction error' });
        }

        try {
            // 1. Prepare data for bulk insert/update
            const planValues = dailyGoals.map((goal, index) => [
                patient_id,
                index + 1, // day number
                goal,      // angle_goal for the day
                holdTime   // hold_time (same for all days in this model)
            ]);

            // 2. Use INSERT ... ON DUPLICATE KEY UPDATE to upsert the plan
            // This will insert new days or update existing ones based on the primary key (patient_id, day)
            if (planValues.length > 0) {
                const upsertQuery = `
                    INSERT INTO treatment_plans (patient_id, day, angle_goal, hold_time)
                    VALUES ?
                    ON DUPLICATE KEY UPDATE
                        angle_goal = VALUES(angle_goal),
                        hold_time = VALUES(hold_time)
                `;
                await new Promise((resolve, reject) => {
                    connection.query(upsertQuery, [planValues], (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    });
                });
            }

            // 3. Optionally: Delete any days beyond the new plan length
            const maxDay = planValues.length;
            const deleteQuery = `DELETE FROM treatment_plans WHERE patient_id = ? AND day > ?`;
            await new Promise((resolve, reject) => {
                connection.query(deleteQuery, [patient_id, maxDay], (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });

            // 4. Commit transaction
            connection.commit((err) => {
                if (err) {
                    return connection.rollback(() => {
                        console.error('Commit error:', err);
                        res.status(500).json({ error: 'Error committing plan adjustments' });
                    });
                }
                res.status(200).json({ success: true, message: `Treatment plan updated successfully.` });
            });

        } catch (error) {
            console.error('Error during plan adjustment:', error);
            connection.rollback(() => {
                res.status(500).json({ error: error.message || 'Error adjusting treatment plan' });
            });
        }
    });
};

/**
 * Route to get the full treatment plan for a patient
 */
const get_treatment_plan = (req, res) => {
    const { patient_id } = req.params;

    if (!patient_id) {
        console.error("Backend: Missing patient ID in get_treatment_plan request.");
        return res.status(400).json({ error: 'Missing patient ID' });
    }

    const qry = `
        SELECT day, angle_goal, hold_time
        FROM treatment_plans
        WHERE patient_id = ?
        ORDER BY day ASC
    `;

    connection.query(qry, [patient_id], (err, results) => {
        if (err) {
            console.error(`Backend: Error fetching treatment plan for patient ${patient_id}:`, err);
            return res.status(500).json({ error: 'Error fetching treatment plan' });
        }
        res.status(200).json(results);
    });
};

/**
 * Export all routes
 */
module.exports = {
    create_doctor,
    create_patient,
    search_patients,
    patient,
    patient_overview,
    doctor_login,
    get_all_doctors,
    patient_data,
    adjust_treatment_plan,
    get_treatment_plan
};
