// The Swift Programming Language
// https://docs.swift.org/swift-book
import Foundation

public struct Quaternion {
    var w: Double
    var x: Double
    var y: Double
    var z: Double
}

public func calculateKneeAngle(femur: Quaternion, tibia: Quaternion) -> Double {
    // Convert quaternions to Euler angles (pitch)
    let femurPitch = quaternionToPitch(quaternion: femur)
    let tibiaPitch = quaternionToPitch(quaternion: tibia)
    
    // Calculate relative angle (knee flexion/extension)
    let kneeAngle = fabs(femurPitch - tibiaPitch)
    
    return kneeAngle
}

public func quaternionToPitch(quaternion: Quaternion) -> Double {
    // Extract pitch (rotation around x-axis) from quaternion
    let sinp = 2.0 * (quaternion.w * quaternion.y - quaternion.z * quaternion.x)
    if abs(sinp) >= 1 {
        return copysign(.pi / 2, sinp) // Use 90 degrees if out of range
    } else {
        return asin(sinp)
    }
}

public func parseQuaternion(from string: String) -> Quaternion? {
    let components = string.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
    guard components.count == 4 else { return nil }
    return Quaternion(w: components[0], x: components[1], y: components[2], z: components[3])
}

public func calculateKneeAngles(from fileContent: String) {
    let lines = fileContent.split(separator: "\n")
    
    // Skip the first line (header)
    for (index, line) in lines.enumerated() {
        if index == 0 {
            continue
        }
        
        // Split line into columns (assuming columns are separated by either tabs or spaces)
        let columns = line.split(whereSeparator: { $0 == "\t" || $0 == " " }).filter { !$0.isEmpty }
        
        // Check if there are enough columns (at least 4 needed for femur and tibia)
        if columns.count >= 4,
           let femurQuaternion = parseQuaternion(from: String(columns[2])),
           let tibiaQuaternion = parseQuaternion(from: String(columns[3])) {
            
            let kneeAngle = calculateKneeAngle(femur: femurQuaternion, tibia: tibiaQuaternion)
            print("Time: \(columns[0]) - Knee Angle: \(kneeAngle * 180.0 / .pi) degrees")
        }
    }
}








