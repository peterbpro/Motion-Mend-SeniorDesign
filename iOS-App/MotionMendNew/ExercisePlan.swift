//
//  ExercisePlan.swift
//  MotionMendNew
//
//  Created by agorka on 2/24/25.
//


import Foundation

struct ExerciseDay: Identifiable {
    let id = UUID()
    let dayNumber: Int
    let minRange: Double = 0 // Default value since not in DB
    let maxRange: Double    // angle_goal from DB
    let holdTime: Int       // hold_time from DB
    let reps: Int = 5       // Default value since not in DB
}

class ExercisePlan: ObservableObject {
    static let shared = ExercisePlan()  // Singleton instance
    @Published var days: [ExerciseDay] = []
    private let db = DatabaseManager.shared
    
    func loadTreatmentPlan(patientId: Int, completion: @escaping (Bool) -> Void) {
        let query = """
        SELECT day, angle_goal, hold_time 
        FROM treatment_plans 
        WHERE patient_id = \(patientId)
        ORDER BY day
        """
        
        db.pools.withConnection { conn in
            return conn.query(query)
        }.whenComplete { [weak self] result in
            switch result {
            case .success(let rows):
                DispatchQueue.main.async {
                    self?.days = rows.compactMap { row in
                        guard let day = row.column("day")?.int,
                              let angleGoal = row.column("angle_goal")?.double,
                              let holdTime = row.column("hold_time")?.int else {
                            return nil
                        }
                        return ExerciseDay(
                            dayNumber: day,
                            maxRange: angleGoal,
                            holdTime: holdTime
                        )
                    }
                    completion(true)
                }
            case .failure(let error):
                print("Failed to load treatment plan: \(error)")
                DispatchQueue.main.async {
                    completion(false)
                }
            }
        }
    }
    
    func getExercise(for day: Int) -> ExerciseDay? {
        return days.first { $0.dayNumber == day }
    }
    
    // Add this to AuthManager
    func getCurrentDay(forPatientId patientId: Int, completion: @escaping (Int?, String?) -> Void) {
        let query = """
        SELECT current_day FROM patients
        WHERE id = \(patientId)
        LIMIT 1
        """
        
        db.pools.withConnection { conn in
            return conn.query(query)
        }.whenComplete { result in
            switch result {
            case .success(let rows):
                if let row = rows.first,
                   let currentDay = row.column("current_day")?.int {
                    completion(currentDay, nil)
                } else {
                    completion(nil, "Patient not found")
                }
            case .failure(let error):
                completion(nil, "Failed to fetch current day: \(error)")
            }
        }
    }
}
