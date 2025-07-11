import CoreBluetooth
import Foundation
import KneeLibrary
import MySQLKit
import Combine

extension DateFormatter {
    static let yyyyMMdd: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
    
    static let timeOnly: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss" // 24-hour format with seconds
        return formatter
    }()
}

class BluetoothManager: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    
    @Published var isBluetoothOn = false
    @Published var discoveredPeripherals: [CBPeripheral] = []
    @Published var connectedPeripheral: CBPeripheral?
    @Published var connectedPeripherals: [CBPeripheral] = []

    @Published var currentKneeAngle: String = ""
    
    private var centralManager: CBCentralManager!
    private var targetPeripheral: CBPeripheral?
    private var db: DatabaseManager
    var avgFemur: [Double] = []
    var avgTibia: [Double] = []
    var counter = 0
    var femur0: Double = 0
    var tibia0: Double = 0
    var femurCurr: Double = 0
    var tibiaCurr: Double = 0
    var angles: [(Double, Double)] = []
    var timestamp0 = Date().timeIntervalSince1970
    let AVG_CALIBRATION = 100 // change to higher value later, ideally 300 ish 
    
    // Global arrays to store roll, pitch, and yaw values for each IMU
    var imu1RollValues: [Double] = []
    var imu1PitchValues: [Double] = []
    var imu1YawValues: [Double] = []
    
    var imu2RollValues: [Double] = []
    var imu2PitchValues: [Double] = []
    var imu2YawValues: [Double] = []
    
    var timestamps: [Double] = []
    var knee_angles_l: [Double] = []
    
    private var bothDevicesConnected: Bool {
            connectedPeripherals.count == 2
        }
    private var calibrationStarted = false

    
    override init() {
//        db = DatabaseManager()
        db = DatabaseManager.shared
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: nil)
    }
    
    func disconnectAllPeripherals() {
            for peripheral in connectedPeripherals {
                centralManager.cancelPeripheralConnection(peripheral)
            }
            connectedPeripherals.removeAll()
            resetCalibrationData()
        }
    
    func refreshPeripheralList() {
            // Clear the discovered peripherals list
            discoveredPeripherals.removeAll()
            
            // Restart scanning if Bluetooth is on
            if centralManager.state == .poweredOn {
                centralManager.scanForPeripherals(withServices: nil, options: nil)
            }
        }
    
    func refreshPeripherals() {
            disconnectAllPeripherals()
            refreshPeripheralList()
        }
    
    private func resetCalibrationData() {
            avgFemur = []
            avgTibia = []
            counter = 0
            femur0 = 0
            tibia0 = 0
            femurCurr = 0
            tibiaCurr = 0
            angles = []
            timestamp0 = Date().timeIntervalSince1970
            calibrationStarted = false
            
            // Clear IMU data arrays
            imu1RollValues = []
            imu1PitchValues = []
            imu1YawValues = []
            imu2RollValues = []
            imu2PitchValues = []
            imu2YawValues = []
            timestamps = []
            knee_angles_l = []
        }
    
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        DispatchQueue.main.async {
            self.isBluetoothOn = central.state == .poweredOn
        }
        
        if central.state == .poweredOn {
            centralManager.scanForPeripherals(withServices: nil, options: nil)
        } else {
            print("Bluetooth is not available")
        }
    }
    
    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String : Any], rssi RSSI: NSNumber) {
        DispatchQueue.main.async {
            if !self.discoveredPeripherals.contains(peripheral) {
                self.discoveredPeripherals.append(peripheral)
            }
        }
    }
    
    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
            DispatchQueue.main.async {
                if !self.connectedPeripherals.contains(peripheral) {
                    self.connectedPeripherals.append(peripheral)
                    print("Connected to \(peripheral.name ?? "Unknown")")
                    
                    // Check if both are now connected
                    if self.connectedPeripherals.count == 2 {
                        print("Both devices connected - ready to calibrate")
                    }
                }
            }
            peripheral.delegate = self
            peripheral.discoverServices(nil)
        }
    
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let services = peripheral.services {
            for service in services {
                peripheral.discoverCharacteristics(nil, for: service)
            }
        }
    }
    
    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let characteristics = service.characteristics {
            for characteristic in characteristics {
                if characteristic.properties.contains(.notify) {
                    peripheral.setNotifyValue(true, for: characteristic)
                }
            }
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if let data = characteristic.value {
            if let dataString = String(data: data, encoding: .utf8) {
                DispatchQueue.main.async {
                    print("Received data", dataString)
                    self.processData(dataString, peripheral: peripheral)
                }
            }
        }
    }
    func processData(_ dataString: String, peripheral: CBPeripheral) {
            // Only process data if both devices are connected
            guard bothDevicesConnected else {
                print("Waiting for both devices to connect...")
                return
            }
            
            let values = dataString.split(separator: ",").compactMap { Double($0) }
            
            guard values.count % 3 == 0 else {
                print("Invalid data format")
                return
            }
            
            // Start calibration if not already started
            if !calibrationStarted && counter == 0 {
                calibrationStarted = true
                print("Starting calibration - please stand still")
                timestamp0 = Date().timeIntervalSince1970
            }
            
            let currentTimestamp = Date().timeIntervalSince1970
            let nanosecondPrecision = DispatchTime.now().uptimeNanoseconds
            
            // Determine if this is femur or tibia based on connection order
            guard let index = connectedPeripherals.firstIndex(of: peripheral) else { return }
            let isFemur = (index == 0)  // First connected is femur
            
            for i in stride(from: 0, to: values.count, by: 3) {
                let roll = values[i]
                let pitch = values[i + 1]
                let yaw = values[i + 2]
                let uniqueTimestamp = currentTimestamp +
                                    (Double(nanosecondPrecision) / 1_000_000_000.0) +
                                    (Double(i) * 0.000001)
                        
                timestamps.append(uniqueTimestamp)
                
                if isFemur {
                    imu1RollValues.append(roll)
                    imu1PitchValues.append(pitch)
                    imu1YawValues.append(yaw)
                    femurCurr = pitch
                } else {
                    imu2RollValues.append(roll)
                    imu2PitchValues.append(pitch)
                    imu2YawValues.append(yaw)
                    tibiaCurr = pitch
                }
            }
            
            // Only collect calibration data if we have both devices connected
            if calibrationStarted && counter < AVG_CALIBRATION {
                if isFemur {
                    avgFemur.append(femurCurr)
                } else {
                    avgTibia.append(tibiaCurr)
                }
                
                // Only increment counter when we have data from both devices
                if avgFemur.count > counter && avgTibia.count > counter {
                    counter += 1
                    print("Calibration progress: \(counter)/\(AVG_CALIBRATION)")
                }
            } else if counter == AVG_CALIBRATION {
                if avgTibia.count > 0 && avgFemur.count > 0 {
                    tibia0 = avgTibia.reduce(0, +) / Double(avgTibia.count)
                    femur0 = avgFemur.reduce(0, +) / Double(avgFemur.count)
                    counter += 1
                    print("Calibration complete! Ready for measurement")
                }
            } else if counter > AVG_CALIBRATION {
                let angle = (femur0 - femurCurr) - (tibia0 - tibiaCurr)
                currentKneeAngle = String(format: "%.2f degrees", angle)
                angles.append((Date().timeIntervalSince1970 - timestamp0, angle))
                knee_angles_l.append(angle)
                print("computed angle: \(angle)")
            }
        }

    
    func saveExerciseSession(
            patientId: Int,
            doctorId: Int,
            day: Int,
            sessionId: Int,
            repCount: Int,
            completion: @escaping (Bool, String) -> Void
        ) {
            let sessionDuration = Int(Date().timeIntervalSince1970 - timestamp0)
            let maxAngle = knee_angles_l.max() ?? 0
            let startDay = DateFormatter.yyyyMMdd.string(from: Date())
            let currentTime = DateFormatter.timeOnly.string(from: Date())
            
            let query = """
                INSERT INTO patient_data (
                    patient_id, doctor_id, start_day, session_id,
                    session_duration, num_reps, max_angle_achieved,
                    session_time
                ) VALUES (
                    \(patientId), \(doctorId), '\(startDay)', \(sessionId),
                    \(sessionDuration), \(repCount), \(maxAngle),
                    '\(currentTime)'
                )
                """
                
                db.executeQuery(query).whenComplete { result in
                    switch result {
                    case .success:
                        completion(true, "Exercise saved successfully")
                    case .failure(let error):
                        completion(false, "Save failed: \(error.localizedDescription)")
                    }
                }
        }
    
    func simulate() {
        guard let filepath = Bundle.main.path(forResource: "data_raw", ofType: "txt") else {
            print("Failed to find data_raw.txt file")
            return
        }
        
        do {
            let fileContent = try String(contentsOfFile: filepath, encoding: .utf8)
            let lines = fileContent.split(separator: "\n")
            var index = 0
            
            Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { timer in
                if index >= lines.count {
                    timer.invalidate()
                    return
                }
                let line = lines[index]
                let columns = line.split(separator: "\t").dropFirst().map{ String($0) }
                guard columns.count >= 2 else { // Only need 2 columns now
                    print("skipping line \(index)")
                    index += 1
                    return
                }
                
                // Process as femur (first device) and tibia (second device)
                DispatchQueue.main.async {
                    if self.connectedPeripherals.count > 0 {
                        self.processData(columns[0], peripheral: self.connectedPeripherals[0])
                    }
                    if self.connectedPeripherals.count > 1 {
                        self.processData(columns[1], peripheral: self.connectedPeripherals[1])
                    }
                }
                index += 1
            }
        } catch {
            print("Error reading data_raw.txt file: \(error)")
        }
    }
    
    func connect(to peripheral: CBPeripheral) {
        print("Connecting to \(peripheral.name ?? "Unknown")")
        centralManager.connect(peripheral, options: nil)
        print("Currently connected peripherals:")
        for (index, connectedPeripheral) in connectedPeripherals.enumerated() {
            print("[\(index)] - \(connectedPeripheral.name ?? "Unknown")")
        }
    }
    
    func disconnect(peripheral: CBPeripheral) {
        centralManager.cancelPeripheralConnection(peripheral)
        DispatchQueue.main.async {
            self.connectedPeripherals.removeAll { $0 == peripheral }
        }
//        if let peripheral = connectedPeripheral {
//            centralManager.cancelPeripheralConnection(peripheral)
//            DispatchQueue.main.async {
//                self.connectedPeripheral = nil
//            }
//        }
    }
}
class DatabaseManager: ObservableObject {
    static let shared = DatabaseManager()
    let configuration: MySQLConfiguration
    let eventLoopGroup: EventLoopGroup
    let pools: EventLoopGroupConnectionPool<MySQLConnectionSource>
    
    private init() {
        var tlsConfig = TLSConfiguration.makeClientConfiguration()
        tlsConfig.certificateVerification = .none
        
        configuration = MySQLConfiguration(
            hostname: "senior-design-db.cwaai2rnwrls.us-east-1.rds.amazonaws.com",
            port: 3306,
            username: "peterismostpro",
            password: "p3tah!theStall1on",
            database: "MOTION_MEND",
            tlsConfiguration: tlsConfig
        )
        eventLoopGroup = MultiThreadedEventLoopGroup(numberOfThreads: 1)
                
        pools = EventLoopGroupConnectionPool(
            source: MySQLConnectionSource(configuration: configuration),
            on: eventLoopGroup
        )
    }
    deinit {
            // Shutdown the pool before deinitializing
        try? pools.shutdown()   // Shut down the pool
            try? eventLoopGroup.syncShutdownGracefully()  // Gracefully shutdown event loop
            print("DatabaseManager deinitialized successfully.")
        }
    
    func executeQuery(_ queryString: String) -> EventLoopFuture<Void> {
        return pools.withConnection { conn in
            return conn.query("SET SESSION net_read_timeout = 360000000000000").flatMap { _ in
                return conn.query("SET SESSION net_write_timeout = 360000000000000").flatMap { _ in
                    return conn.query(queryString)
                        .map { result in
                            print("Query executed successfully")
                            return ()
                        }
                        .flatMapError { error in
                            print("Failed to execute query: \(error)")
                            return conn.eventLoop.future(error: error)
                        }
                }
            }
        }
    }
}





