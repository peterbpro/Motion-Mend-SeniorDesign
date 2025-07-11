import Foundation
import MySQLKit
import Combine

enum UserType: Equatable  {
    case doctor
    case patient
}

struct User: Equatable {
    let id: Int
    let name: String
    let username: String
    let userType: UserType
    let doctorId: Int? // Only applicable for patients
    
    static func == (lhs: User, rhs: User) -> Bool {
            return lhs.id == rhs.id &&
                   lhs.name == rhs.name &&
                   lhs.username == rhs.username &&
                   lhs.userType == rhs.userType &&
                   lhs.doctorId == rhs.doctorId
        }
}

class AuthManager: ObservableObject {
    private let db: DatabaseManager
    
    init(databaseManager: DatabaseManager) {
        self.db = databaseManager
    }
    
    // MARK: - Doctor Authentication
    
    func createDoctorAccount(name: String, username: String, password: String, completion: @escaping (Bool, String) -> Void) {
        let query = """
        INSERT INTO doctors (name, username, password)
        VALUES ('\(name)', '\(username)', '\(password)')
        """
        
        db.executeQuery(query).whenComplete { result in
            switch result {
            case .success:
                completion(true, "Doctor account created successfully")
            case .failure(let error):
                completion(false, "Failed to create doctor account: \(error)")
            }
        }
    }
    
    func loginDoctor(username: String, password: String, completion: @escaping (Bool, User?, String) -> Void) {
        let query = """
        SELECT id, name FROM doctors
        WHERE username = '\(username)' AND password = '\(password)'
        LIMIT 1
        """
        
        db.pools.withConnection { conn in
            return conn.query(query)
        }.whenComplete { result in
            switch result {
            case .success(let rows):
                if let row = rows.first,
                   let doctorId = row.column("id")?.int,
                   let name = row.column("name")?.string {
                    let user = User(
                        id: doctorId,
                        name: name,
                        username: username,
                        userType: .doctor,
                        doctorId: nil
                    )
                    completion(true, user, "Login successful")
                } else {
                    completion(false, nil, "Invalid username or password")
                }
            case .failure(let error):
                completion(false, nil, "Login failed: \(error)")
            }
        }
    }
    
    // MARK: - Patient Authentication
    
    func createPatientAccount(doctorId: Int, name: String, username: String, password: String, completion: @escaping (Bool, String) -> Void) {
        let query = """
        INSERT INTO patients (doctor_id, name, username, password)
        VALUES (\(doctorId), '\(name)', '\(username)', '\(password)')
        """
        
        db.executeQuery(query).whenComplete { result in
            switch result {
            case .success:
                completion(true, "Patient account created successfully")
            case .failure(let error):
                completion(false, "Failed to create patient account: \(error)")
            }
        }
    }
    
    func loginPatient(username: String, password: String, completion: @escaping (Bool, User?, String) -> Void) {
        let query = """
        SELECT id, name, doctor_id FROM patients
        WHERE username = '\(username)' AND password = '\(password)'
        LIMIT 1
        """
        
        db.pools.withConnection { conn in
            return conn.query(query)
        }.whenComplete { result in
            switch result {
            case .success(let rows):
                if let row = rows.first,
                   let patientId = row.column("id")?.int,
                   let name = row.column("name")?.string,
                   let doctorId = row.column("doctor_id")?.int {
                    let user = User(
                        id: patientId,
                        name: name,
                        username: username,
                        userType: .patient,
                        doctorId: doctorId
                    )
                    completion(true, user, "Login successful")
                } else {
                    completion(false, nil, "Invalid username or password")
                }
            case .failure(let error):
                completion(false, nil, "Login failed: \(error)")
            }
        }
    }
    
    // MARK: - Generic Login
    
    func login(username: String, password: String, completion: @escaping (Bool, User?, String) -> Void) {
        // First try to login as a doctor
        loginDoctor(username: username, password: password) { success, user, message in
            if success, user != nil {
                completion(true, user, message)
            } else {
                // If doctor login fails, try patient login
                self.loginPatient(username: username, password: password) { success, user, message in
                    completion(success, user, message)
                }
            }
        }
    }
    
}
