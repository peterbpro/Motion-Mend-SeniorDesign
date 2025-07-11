import SwiftUI
import KneeLibrary

//#Preview {
//    ContentView()
//}

struct ContentView: View {
    @StateObject private var bluetoothManager = BluetoothManager()
    @State private var isSimulationMode: Bool? = nil
//    @State private var showExercisePlan = false // for navigationstate
    @State private var currentPage: AppPage = .login
    @State var currentDay: Int = 1 // CURRENT EXERCISE DAY
    
    @StateObject private var viewModel = ExerciseViewModel()
    
    @StateObject private var userSession = UserSession(user: nil) // Initialize with nil
        
        // Create an instance of AuthManager
    @StateObject private var authManager = AuthManager(databaseManager: DatabaseManager.shared)


    var body: some View {
            NavigationView {
                ZStack(alignment: .bottom) {
                    VStack(spacing: 0) {
                        if currentPage == .login {
                            LoginView(authManager: authManager, userSession: userSession, currentPage: $currentPage)
                        }
                        else if currentPage == .home {
                            HomeView(bluetoothManager: bluetoothManager,
                                     viewModel: viewModel,
                                     isSimulationMode: $isSimulationMode,
                                     currentPage: $currentPage) // Add the binding
                        
                        } else if currentPage == .exercise {
                            ExerciseModeView(viewModel: viewModel, isSimulationMode: $isSimulationMode, bluetoothManager: bluetoothManager, currentDay: $currentDay, userSession: userSession)
                        } else if currentPage == .exercisePlan {
                            ExercisePlanView(
                                    currentDay: $currentDay,
                                    userSession: userSession  // Pass the user session
                                )
                        }
                        else if currentPage == .deviceSetup { // Add this new case
                            DeviceSetupView(bluetoothManager: bluetoothManager, currentPage: $currentPage)
                        }
                        
                        // Add spacing for the navbar
                        Spacer()
                            .frame(height: 100) // Adjust this value based on your navbar height
                    }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color("WHITE"))
                    
                    // Nav bar at the bottom with full width
                    NavBarView(currentPage: $currentPage, userSession: userSession)
                        .frame(maxWidth: .infinity)
                        .background(Color(UIColor.systemBackground).opacity(0.95)) // Optional: semi-transparent background
                }
                .ignoresSafeArea(edges: [.horizontal, .bottom])
                .onChange(of: bluetoothManager.currentKneeAngle) { _ in
                    viewModel.updateRepCount(bluetoothManager.currentKneeAngle)
                }
                .onChange(of: userSession.user) { newUser in
                            if let user = newUser {
                                loadTreatmentPlan(for: user)
                            }
                        }
            
                .onAppear {
                    viewModel.updateForDay(currentDay)
                }
                .onChange(of: currentDay) { newDay in
                    viewModel.updateForDay(newDay)
                }
                
                .onChange(of: bluetoothManager.currentKneeAngle) { _ in
                    viewModel.updateKneeAngle(from: bluetoothManager.currentKneeAngle)
                }
                .onAppear {
                    viewModel.currentDay = currentDay  // Initialize with currentDay
                    viewModel.updateForDay(currentDay)
                }
                .onChange(of: currentDay) { newDay in
                    viewModel.currentDay = newDay  // Keep viewModel in sync
                    viewModel.updateForDay(newDay)
                }
            }
        }
    
    private func loadTreatmentPlan(for user: User) {
            let patientId = user.userType == .patient ? user.id : 1
            viewModel.loadTreatmentPlan(patientId: patientId) { success in
                if success {
                    // This will now be in sync since ExercisePlanView updates the binding
                    print("Current day after load: \(currentDay)")
                }
            }
        }
    
}

import SwiftUI

struct LoginView: View {
    // Login State
    @State private var username = ""
    @State private var password = ""
    @State private var isLoggingIn = false
    
    // Registration State
    @State private var showingRegistration = false
    @State private var regName = ""
    @State private var regUsername = ""
    @State private var regPassword = ""
    @State private var regConfirmPassword = ""
    @State private var isDoctor = false
    @State private var doctorId = ""
    @State private var isRegistering = false
    
    // Common State
    @State private var errorMessage = ""
    @State private var showError = false
    
    var authManager: AuthManager
    @ObservedObject var userSession: UserSession
    @Binding var currentPage: AppPage
    
    var body: some View {
        ZStack {
            Color("WHITE").edgesIgnoringSafeArea(.all)
            
            if showingRegistration {
                CreateAccountView(
                    name: $regName,
                    username: $regUsername,
                    password: $regPassword,
                    confirmPassword: $regConfirmPassword,
                    isDoctor: $isDoctor,
                    doctorId: $doctorId,
                    isRegistering: $isRegistering,
                    errorMessage: $errorMessage,
                    showError: $showError,
                    authManager: authManager,
                    switchToLogin: { showingRegistration = false }
                )
            } else {
                LoginFormView(
                    username: $username,
                    password: $password,
                    isLoggingIn: $isLoggingIn,
                    errorMessage: $errorMessage,
                    showError: $showError,
                    authManager: authManager,
                    userSession: userSession,
                    currentPage: $currentPage,
                    switchToRegister: { showingRegistration = true }
                )
            }
        }
    }
}

// MARK: - DEVICE SETUP
struct DeviceSetupView: View {
    @ObservedObject var bluetoothManager: BluetoothManager
    @Binding var currentPage: AppPage

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Device Setup Instructions")
                    .font(.title)
                    .bold()
                    .foregroundColor(Color("DARK"))
                    .padding(.bottom, 10)
                
                // Step 1
                VStack(alignment: .leading, spacing: 8) {
                    Text("Step 1: First Module")
                        .font(.headline)
                    
                    Text("Turn on the first module and attach it right above the knee. Device will stop flashing when connected successfully.")
                        .font(.body)
                    
                    // Replace "modulePlacement" with your actual image name
                    Image("modulePlacement2") // Make sure to add this image to your assets
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity)
                        .cornerRadius(10)
                    
                    Button(action: {
                        // Help user connect to first device
                        bluetoothManager.refreshPeripheralList()
                        currentPage = .home

                    }) {
                        Text("Connect First Module")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(12)
                
                // Step 2
                VStack(alignment: .leading, spacing: 8) {
                    Text("Step 2: Second Module")
                        .font(.headline)
                    
                    Text("Turn on the second module and attach it below the knee. Device will stop flashing when connected successfully.")
                        .font(.body)
                    
                    // Replace "modulePlacement2" with your actual image name
                    Image("modulePlacement") // Make sure to add this image to your assets
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity)
                        .cornerRadius(10)
                    
                    Button(action: {
                        // Help user connect to second device
                        bluetoothManager.refreshPeripheralList()
                        currentPage = .home

                    }) {
                        Text("Connect Second Module")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(bluetoothManager.connectedPeripherals.count >= 1 ? Color.blue : Color.gray)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                    .disabled(bluetoothManager.connectedPeripherals.count < 1)
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(12)
                
                // Status indicator
                VStack {
                    Text("Connection Status")
                        .font(.headline)
                    
                    HStack {
                        Circle()
                            .fill(bluetoothManager.connectedPeripherals.count >= 1 ? Color.green : Color.red)
                            .frame(width: 20, height: 20)
                        Text("First Module: \(bluetoothManager.connectedPeripherals.count >= 1 ? "Connected" : "Disconnected")")
                        
                        Spacer()
                        
                        Circle()
                            .fill(bluetoothManager.connectedPeripherals.count >= 2 ? Color.green : Color.red)
                            .frame(width: 20, height: 20)
                        Text("Second Module: \(bluetoothManager.connectedPeripherals.count >= 2 ? "Connected" : "Disconnected")")
                    }
                    .padding()
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(12)
                
                // Navigation to home when both are connected
                if bluetoothManager.connectedPeripherals.count >= 2 {
                    Button("Continue to Exercise") {
                        // You'll need to handle navigation here
                        // This would require passing a binding to currentPage
                        currentPage = .home

                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                    .padding(.top, 20)
                }
            }
            .padding()
        }
    }
}


// MARK: - Login Form

struct LoginFormView: View {
    @Binding var username: String
    @Binding var password: String
    @Binding var isLoggingIn: Bool
    @Binding var errorMessage: String
    @Binding var showError: Bool
    
    var authManager: AuthManager
    @ObservedObject var userSession: UserSession
    @Binding var currentPage: AppPage
    var switchToRegister: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            Image("MotionMendLogoCropped")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 300)
                .padding(.bottom, 10)
            
            Text("Welcome Back")
                .font(.largeTitle)
                .bold()
                .foregroundColor(.black)
            
            // Form
            VStack(spacing: 15) {
                TextField("Username", text: $username)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .autocapitalization(.none)
                
                SecureField("Password", text: $password)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
                Button(action: performLogin) {
                    if isLoggingIn {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text("Log In")
                            .font(.headline)
                            .foregroundColor(.white)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .cornerRadius(10)
                .disabled(isLoggingIn)
            }
            .padding(.horizontal)
            
            // Footer
            HStack {
                Text("Don't have an account?")
                    .foregroundColor(.black)
                
                Button(action: switchToRegister) {
                    Text("Register")
                        .fontWeight(.bold)
                        .foregroundColor(.blue)
                }
            }
            .padding(.top, 10)
            
            Spacer()
        }
        .padding()
        .alert(isPresented: $showError) {
            Alert(title: Text("Login Notice"),
                  message: Text(errorMessage),
                  dismissButton: .default(Text("OK")))
        }
    }
    
    private func performLogin() {
        guard !username.isEmpty && !password.isEmpty else {
            errorMessage = "Please enter both username and password"
            showError = true
            return
        }
        
        isLoggingIn = true
        
        authManager.login(username: username, password: password) { success, user, message in
            DispatchQueue.main.async {
                isLoggingIn = false
                
                if success, let user = user {
                    userSession.user = user
                    currentPage = .home
                } else {
                    errorMessage = message
                    showError = true
                }
            }
        }
    }
}

// MARK: - Create Account View

struct CreateAccountView: View {
    @Binding var name: String
    @Binding var username: String
    @Binding var password: String
    @Binding var confirmPassword: String
    @Binding var isDoctor: Bool
    @Binding var doctorId: String
    @Binding var isRegistering: Bool
    @Binding var errorMessage: String
    @Binding var showError: Bool
    
    var authManager: AuthManager
    var switchToLogin: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            Image("MotionMendLogoCropped")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 300)
                .padding(.bottom, 10)
            
            Text("Create Account")
                .font(.largeTitle)
                .bold()
                .foregroundColor(.black)
            
            // Form
            VStack(spacing: 15) {
                TextField("Full Name", text: $name)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
                TextField("Username", text: $username)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .autocapitalization(.none)
                
                SecureField("Password", text: $password)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
                SecureField("Confirm Password", text: $confirmPassword)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
                Toggle("Are you a patient?", isOn: $isDoctor)
                    .toggleStyle(SwitchToggleStyle(tint: .blue))
                    .padding(.vertical, 5)
                
                if !isDoctor {
                    TextField("Doctor ID", text: $doctorId)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .keyboardType(.numberPad)
                }
                
                Button(action: performRegistration) {
                    if isRegistering {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Text("Create Account")
                            .font(.headline)
                            .foregroundColor(.white)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .cornerRadius(10)
                .disabled(isRegistering)
            }
            .padding(.horizontal)
            
            // Footer
            HStack {
                Text("Already have an account?")
                    .foregroundColor(.black)
                
                Button(action: switchToLogin) {
                    Text("Login")
                        .fontWeight(.bold)
                        .foregroundColor(.blue)
                }
            }
            .padding(.top, 10)
            
            Spacer()
        }
        .padding()
        .alert(isPresented: $showError) {
            Alert(title: Text("Registration Notice"),
                  message: Text(errorMessage),
                  dismissButton: .default(Text("OK")))
        }
    }
    
    private func performRegistration() {
        // Validate all fields
        guard !name.isEmpty else {
            errorMessage = "Please enter your name"
            showError = true
            return
        }
        
        guard !username.isEmpty else {
            errorMessage = "Please enter a username"
            showError = true
            return
        }
        
        guard !password.isEmpty else {
            errorMessage = "Please enter a password"
            showError = true
            return
        }
        
        guard password == confirmPassword else {
            errorMessage = "Passwords don't match"
            showError = true
            return
        }
        
        if !isDoctor {
            guard !doctorId.isEmpty, Int(doctorId) != nil else {
                errorMessage = "Please enter a valid doctor ID"
                showError = true
                return
            }
        }
        
        isRegistering = true
        
        if isDoctor {
            authManager.createDoctorAccount(
                name: name,
                username: username,
                password: password
            ) { success, message in
                handleRegistrationResult(success: success, message: message)
            }
        } else {
            authManager.createPatientAccount(
                doctorId: Int(doctorId)!,
                name: name,
                username: username,
                password: password
            ) { success, message in
                handleRegistrationResult(success: success, message: message)
            }
        }
    }
    
    private func handleRegistrationResult(success: Bool, message: String) {
        DispatchQueue.main.async {
            isRegistering = false
            
            if success {
                errorMessage = "Account created successfully! Please log in."
                showError = true
                switchToLogin()
                
                // Clear fields
                name = ""
                username = ""
                password = ""
                confirmPassword = ""
                doctorId = ""
            } else {
                errorMessage = message
                showError = true
            }
        }
    }
}

// A class to hold the current user session and pass it around the app
class UserSession: ObservableObject {
    @Published var user: User?
    
    init(user: User?) {
        self.user = user
    }
}

enum AppPage {
    case login
    case home
    case exercise
    case exercisePlan
    case deviceSetup
}

struct PeripheralListView: View {
    @ObservedObject var bluetoothManager: BluetoothManager
    
    var body: some View {
        VStack {
            HStack {
                Text("Available Devices")
                    .font(.headline)
                Spacer()
                Menu {
                    Button(action: {
                        bluetoothManager.refreshPeripheralList()
                    }) {
                        Label("Refresh List", systemImage: "arrow.clockwise")
                    }
                    
                    Button(action: {
                        bluetoothManager.disconnectAllPeripherals()
                    }) {
                        Label("Disconnect All", systemImage: "xmark.circle")
                    }
                    
                    Button(action: {
                        bluetoothManager.refreshPeripherals() // Does both
                    }) {
                        Label("Refresh and Disconnect All", systemImage: "arrow.clockwise.circle")
                    }
                } label: {
                    HStack {
                        Image(systemName: "arrow.clockwise")
                        Text("Refresh")
                    }
                }
            }
            .padding(.horizontal)
            
            List(bluetoothManager.discoveredPeripherals, id: \.identifier) { peripheral in
                if let name = peripheral.name {
                    HStack {
                        Text(name)
                        Spacer()
                        if bluetoothManager.connectedPeripherals.contains(peripheral) {
                            Text("Connected").foregroundStyle(.green)
                        } else {
                            Button("Connect") {
                                bluetoothManager.connect(to: peripheral)
                            }
                        }
                    }
                }
            }
        }
    }
}

struct SimulationButtonsView: View {
    @Binding var isSimulationMode: Bool?
    
    var body: some View {
        HStack {
            Button("Simulation Mode") {
                isSimulationMode = true
            }
            .buttonStyle(ModeButtonStyle(color: .blue))
            
            Button("Exercise Mode") {
                isSimulationMode = false
            }
            .buttonStyle(ModeButtonStyle(color: .green))
        }
        .padding(.bottom, 20)
    }
}

struct ExerciseInfoView: View {
    @Binding var isExpanded: Bool
    var exerciseInfo: String
    
    var body: some View {
        VStack {
            Button(action: {
                withAnimation(.spring()) {
                    isExpanded.toggle()
                }
            }) {
                Image(systemName: "info.circle")
                    .font(.system(size: 22))
                    .foregroundColor(Color("DARK"))
                    .padding(8)
                    .background(Circle().fill(Color.blue.opacity(0.1)))
            }
        }
        .sheet(isPresented: $isExpanded) {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Exercise Instructions")
                        .font(.headline)
                        .foregroundColor(Color("DARK"))
                    
                    Text(exerciseInfo)
                        .font(.subheadline)
                        .foregroundColor(.gray)
                        .padding(.bottom, 20)
                    
                    Button("Close") {
                        isExpanded = false
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .padding()
            }
            .presentationDetents([.medium, .large]) // Prevents it from being too big
            .presentationDragIndicator(.visible) // Shows a draggable bar
        }
    }
}


struct MotivationTextView: View {
    var text: String
    var body: some View {
        Text(text)
            .font(.headline)
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.blue.opacity(0.2))
            .cornerRadius(12)
            .animation(.easeInOut, value: text)
            .foregroundColor(Color.black)
    }
}

struct ExerciseModeView: View {
    @ObservedObject var viewModel: ExerciseViewModel
    @Binding var isSimulationMode: Bool?
    var bluetoothManager: BluetoothManager
    @Binding var currentDay: Int
    
    @State private var showExerciseInfo: Bool = false
    
    @ObservedObject var userSession: UserSession

    
    var body: some View {
        VStack {
            VStack {
                Text("Day \(currentDay) Exercise")
                    .font(.title2)
                    .bold()
                    .foregroundColor(Color("DARK"))
                
                Spacer()
                
                ExerciseInfoView(
                    isExpanded: $showExerciseInfo,
                    exerciseInfo: viewModel.getExerciseInfo(for: currentDay)
                )
            }
            .padding(.horizontal)
//            InstructionsView()
            KneeVisualizationView(viewModel: viewModel)
            MotivationTextView(text: viewModel.motivationalText)
            ProgressViewSection(viewModel: viewModel)
            StartButtonView(viewModel: viewModel, bluetoothManager: bluetoothManager, isSimulationMode: isSimulationMode, currentDay: $currentDay, completeExercise: completeExercise, userSession: userSession)
        }
    }
    func completeExercise() {
//        repCount = 0 // dont want to reset it i think
        
        guard let user = userSession.user else {
                    print("Error: No user logged in")
                    return
                }
//        bluetoothManager.saveDataToDatabase()
//        let nextSessionId = 1 // You determine this
//        let nextSessionId = UUID().hashValue
        let nextSessionId = Int.random(in: 100_000_000..<1_000_000_000)
        let currentRepCount = viewModel.repCount // You track this

        bluetoothManager.saveExerciseSession(
            patientId: user.id,
            doctorId: user.doctorId ?? 1, // Provide default if nil
            day: currentDay,
            sessionId: nextSessionId,
            repCount: currentRepCount
        ) { success, message in
            print(message)
            if success {
                // Handle successful save
                print("SUCCESSFUL UPLOAD OF EXERCISE")
            
            } else {
                // Handle error
            }
        }
        
        
        viewModel.hasReachedGoalAngle = false
        viewModel.approachingFullExtension = false
        viewModel.repCount = 0
//        currentDay += 1
        viewModel.updateForDay(currentDay)
        viewModel.isExerciseInProgress = false
        viewModel.startCooldown()
        viewModel.motivationalText = "Congrats! You've completed the exercise!"
    }
}
struct ExercisePlanView: View {
    @ObservedObject var exercisePlan = ExercisePlan.shared
    @Binding var currentDay: Int
    @ObservedObject var userSession: UserSession
    
    var body: some View {
        VStack(spacing: 0) {
            Text("Exercise Plan - Day \(currentDay)")
                .font(.title2)
                .padding()
            
            if exercisePlan.days.isEmpty {
                Text("No treatment plan available")
                    .padding()
            } else {
                List(exercisePlan.days) { day in
                    VStack(alignment: .leading) {
                        Text("Day \(day.dayNumber)")
                            .font(.headline)
                            .bold(day.dayNumber == currentDay)
                        Text("Range: 0 - \(Int(day.maxRange))°")
                        Text("Hold at: \(Int(day.maxRange))° for \(day.holdTime) sec")
                    }
                    .padding()
                    .background(day.dayNumber == currentDay ? Color.blue.opacity(0.2) : Color.clear)
                    .cornerRadius(10)
                }
                .listStyle(PlainListStyle())
            }
        }
        .onAppear {
            loadCurrentDayFromDatabase()
        }
    }
    
    private func loadCurrentDayFromDatabase() {
        guard let user = userSession.user else { return }
        
        let patientId = user.userType == .patient ? user.id : 1
        exercisePlan.getCurrentDay(forPatientId: patientId) { day, _ in
            DispatchQueue.main.async {
                if let day = day {
                    currentDay = day // Updates the binding which will flow back to ContentView
                }
            }
        }
    }
}

class ExerciseViewModel: ObservableObject {
    @Published var repCount: Int = 0
    @Published var hasReachedNinety: Bool = false // delete later
    @Published var approachingFullExtension: Bool = false // delete later
    @Published var motivationalText: String = "Bend your knee"
    @Published var isExerciseInProgress: Bool = false
    @Published var kneeAngle: Double = 0.0
    

    var totalReps: Int = 5 // To be based on the calendar later
    @Published var maxKneeAngle: Double = 0.0 // max reached so far
//    @Binding var currentDay: Int
    var currentDay: Int = 1
    
    @Published var goalAngle: Double = 90.0 // default initializer, updated later
    @Published var hasReachedGoalAngle: Bool = false // if they have finished the goal angle, and need to return to starting range (0 - 10)
    let minFinishDegrees: Double = 5 // the angle to return to to "straighten out" and complete a rep
    
    @Published var cooldownTime: Int = 0
    private var timer: Timer?
    
    @Published var exercisePlan = ExercisePlan.shared  // Use shared instance

    
    func loadTreatmentPlan(patientId: Int, completion: @escaping (Bool) -> Void) {
        // First get the current day from ExercisePlan
        self.exercisePlan.getCurrentDay(forPatientId: patientId) { [weak self] currentDay, error in
            if let error = error {
                print("Error getting current day: \(error)")
                
                DispatchQueue.main.async {
                    completion(false)
                }
                return
            }
            
            if let currentDay = currentDay {
                DispatchQueue.main.async {
                    self?.currentDay = currentDay
                }
                print("Retrieved current day: \(currentDay)")
            }
            
            // Then load the treatment plan
            self?.exercisePlan.loadTreatmentPlan(patientId: patientId) { [weak self] success in
                DispatchQueue.main.async {
                    if success {
                        self?.updateForDay(self?.currentDay ?? 1)
                    }
                    completion(success)
                }
            }
        }
    }
    
    func updateForDay(_ currentDay: Int) {
        if let day = exercisePlan.getExercise(for: currentDay) {
                    goalAngle = day.maxRange
                    maxKneeAngle = 0
                    totalReps = day.reps
            print("Updated goal angle to: \(goalAngle) for day \(currentDay)")
        } else {
            print("No treatment plan found for day \(currentDay)")
        }
    }
    func getExerciseInfo(for day: Int) -> String {
            if let day = exercisePlan.getExercise(for: day) {
                return """
                Exercise: Knee Flexion
                Goal angle: \(Int(day.maxRange))°
                Hold time: \(day.holdTime) seconds
                Reps: \(day.reps)
                """
            } else {
                return "Exercise information not available."
            }
        }
    
    func startCooldown() {
        cooldownTime = 20
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if self.cooldownTime > 0 {
                self.cooldownTime -= 1
            } else {
                self.timer?.invalidate()
                self.timer = nil
            }
        }
    }
    
    private let motivationalQuotes = [
        "Great job!", "You're doing amazing!", "Stay strong!", "Fantastic effort!", "You're crushing it!"
    ]
    
    func getKneeAngle() -> Double {
        return kneeAngle
    }
    func updateKneeAngle(from angleString: String) {
        if let angle = Double(angleString.replacingOccurrences(of: " degrees", with: "")) {
            kneeAngle = max(angle, 0) // clamp to 0 to prevent -degree
            maxKneeAngle = max(maxKneeAngle, kneeAngle)
            print(maxKneeAngle)
            print(kneeAngle)

        }
    }
    
    // called automatically based on any changes to kneeAngle
    func updateRepCount(_ angleString: String) {
//        let kneeAngle = getKneeAngle(from: angleString) + 10
        if cooldownTime != 0 || !isExerciseInProgress { return }
        // almost at the goal angle, motivate them
        if kneeAngle >= goalAngle * 0.75 && kneeAngle < goalAngle && !hasReachedGoalAngle {
            approachingFullExtension = true
            motivationalText = "Almost there!"
        } else if kneeAngle >= goalAngle { // has reached goal angle
            hasReachedGoalAngle = true
            approachingFullExtension = false
            motivationalText = "Straighten out!"
        } else if kneeAngle < minFinishDegrees && hasReachedGoalAngle { // finished a rep
            hasReachedGoalAngle = false
            maxKneeAngle = 0
            repCount = min (repCount + 1, totalReps) // clamp it

            if (repCount >= totalReps) {
                // done with all the reps
                // now what? Automatically finish the exercise i guess
//                completeExercise()
            }
            

            motivationalText = motivationalQuotes.randomElement() ?? "Great job!"
        } else if kneeAngle < goalAngle * 0.90 {
            approachingFullExtension = false
        }
    }
}

struct StartButtonView: View {
    @ObservedObject var viewModel: ExerciseViewModel
    var bluetoothManager: BluetoothManager
    var isSimulationMode: Bool?
    @Binding var currentDay: Int
    var completeExercise: () -> Void // stupid ass callback
    
    @ObservedObject var userSession: UserSession  // Add this

    
    var body: some View {
        Button(action: {
            if viewModel.cooldownTime == 0 {
                if !viewModel.isExerciseInProgress {
                    if isSimulationMode == true {
                        bluetoothManager.simulate()
                    }
                    viewModel.isExerciseInProgress = true
                } else {
//                    bluetoothManager.saveDataToDatabase()
//                    viewModel.completeExercise()
                    completeExercise()
                }
            }
        }) {
            Text(viewModel.cooldownTime > 0 ? "Wait \(viewModel.cooldownTime)s" : (viewModel.isExerciseInProgress ? "End Exercise" : "Start Exercise"))
                .font(.title3)
                .bold()
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(viewModel.isExerciseInProgress ? Color.red : Color.blue)
                .cornerRadius(15)
                .shadow(radius: 5)
        }
        .padding(.horizontal, 20)
    }
    
}

struct ProgressViewSection: View {
    @ObservedObject var viewModel: ExerciseViewModel
    
    var body: some View {
        VStack {
            Text("Exercise progress")
            
            ProgressView(value: Double(viewModel.repCount), total: Double(viewModel.totalReps))
                .progressViewStyle(LinearProgressViewStyle(tint: Color.blue))
                .frame(width: 250)
                .scaleEffect(x: 1, y: 3, anchor: .center)
                .padding()
            
            Text("\(viewModel.repCount) of \(viewModel.totalReps) Reps")
                .font(.subheadline)
                .foregroundColor(.gray)
        }
    }
}
struct DegreeLabels: View {
    var body: some View {
//        let angles = [0, 30, 60, 90]
        let angles = [90, 60, 30, 0]

        let tickOffset: CGFloat = 125.0
        
        ForEach(angles, id: \ .self) { angle in
            let tickAngle = (Double(angle)) * .pi / 180
            let xOffset = tickOffset * cos(tickAngle)
            let yOffset = tickOffset * sin(tickAngle)
            
            Text("\(Int(angle))")
                .font(.caption)
                .foregroundColor(Color.gray)
                .offset(x: xOffset,
                        y: yOffset)
            
        }
    }
}

struct KneeVisualizationView: View {
    @ObservedObject var viewModel: ExerciseViewModel
    var body: some View {
        VStack {
            Text("Knee visualization")
                .font(.title2)
                .bold()
                .padding()
                .foregroundColor(Color.gray)

            Text("\(Int(viewModel.kneeAngle))°")
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .padding(.vertical, 8)
                .padding(.horizontal, 16)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color("DARK"))
                        .shadow(radius: 4)
                )
                .padding(.top, 10)
            ZStack {
                // background arc showing progress
                let maxTrim: CGFloat = 0.25
                // goal angle circle
                let radius: CGFloat = 110
                let goalAngleRadians = (viewModel.goalAngle) * .pi / 180
                DegreeLabels()
                Circle()
                    .trim(from: 0, to: 0.25)
                    .stroke(Color("LIGHT_GRAY"), style: StrokeStyle(lineWidth: 14, lineCap: .round))
                    .frame(width:220, height: 220)
//                    .rotationEffect(.degrees(180))
//                    .scaleEffect(x: -1, y:1) // lazy fix by me to flip it right
                Circle()
                    .trim(from: 0.75 - maxTrim * CGFloat(min(viewModel.maxKneeAngle, 90.0)) / 90, to: 0.75)
                    .stroke(Color.blue.opacity(0.3), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .frame(width:220, height: 220)
                    .rotationEffect(.degrees(270))
                    .scaleEffect(x: -1, y:1)
                    .animation(.easeInOut, value: viewModel.maxKneeAngle)

                // current arc
                Circle()
                    .trim(from: 0.75 - maxTrim * CGFloat(min(viewModel.kneeAngle, 90.0)) / 90, to: 0.75)
                    .stroke(Color.blue, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .frame(width:220, height: 220)
                    .rotationEffect(.degrees(270))
                    .scaleEffect(x: -1, y:1) // lazy fix by me to flip it right

                    .animation(.easeInOut, value: viewModel.kneeAngle)
                // background arc to show the outline of where to go
            

                    .animation(.easeInOut, value: viewModel.kneeAngle)
                
                // add a small dot for the goal/target angle
                Circle()
                    .fill(Color.black)
                    .frame(width: 12, height: 12)
                    .offset(x: radius * cos(goalAngleRadians), y: radius * sin(goalAngleRadians))
                
                ZStack {
                    Image("knee")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 150, height: 150)
                        .rotationEffect(.degrees(-75))
                    Image("foot")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 150, height: 150)
                        .rotationEffect(.degrees(viewModel.getKneeAngle() - 75))
                        .animation(.easeInOut(duration: 0.4), value: viewModel.getKneeAngle())
                }
            }
            .padding()
        }
    }
}
struct NavBarView: View {
    @Binding var currentPage: AppPage // to take in a binding
    @ObservedObject var userSession: UserSession

    var body: some View {
        HStack {
            Button(action: {
                guard userSession.user != nil else { return }
                currentPage = .home
            }) {
                
                Image("icons_home")
                    .renderingMode(.template)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 40, height: 40)
                    .foregroundColor(Color("WHITE"))
            }
            Spacer()
            Button(action: {
                guard userSession.user != nil else { return }
                currentPage = .exercise
            }) {
                Image("icons_exercise")
                    .renderingMode(.template)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 40, height: 40)
                    .foregroundColor(Color("WHITE"))
            }
            Spacer()
            Button(action: {
                guard userSession.user != nil else { return }
                currentPage = .exercisePlan
            }) {
                Image("icons_calendar")
                    .renderingMode(.template)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 40, height: 40)
                    .foregroundColor(Color("WHITE"))
            }
            Spacer()
            Button(action: {}) {
                Image("icons_profile")
                    .renderingMode(.template)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 40, height: 40)
                    .foregroundColor(Color("WHITE"))
            }
        }
        .padding()
        .padding(.bottom, 20) // This moves the content higher within the navbar
        .frame(maxWidth: .infinity, minHeight: 100)
        .background(Color("DARK"))
        .edgesIgnoringSafeArea([.horizontal, .bottom]) // Ignore safe area on all sides

//        .background(Color("MY_THEME"))
//        .background(Color(UIColor(hex: "#153243") ?? .blue))
        
    }
}

//struct HomeView: View {
//    var bluetoothManager: BluetoothManager
//    var viewModel: ExerciseViewModel
//    @Binding var isSimulationMode: Bool?
//    
//    var body: some View {
//        VStack {
//            Image("MotionMendLogoCropped")
//                .resizable()
//                .scaledToFit()
//            PeripheralListView(bluetoothManager: bluetoothManager)
//            SimulationButtonsView(isSimulationMode: $isSimulationMode)
//        }
//    }
//}
struct HomeView: View {
    var bluetoothManager: BluetoothManager
    var viewModel: ExerciseViewModel
    @Binding var isSimulationMode: Bool?
    @Binding var currentPage: AppPage // Add this binding
    
    var body: some View {
        VStack {
            Image("MotionMendLogoCropped")
                .resizable()
                .scaledToFit()
            
            Button(action: {
                currentPage = .deviceSetup
            }) {
                Text("Device Setup Instructions")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                    .padding(.horizontal)
            }
            
            PeripheralListView(bluetoothManager: bluetoothManager)
            SimulationButtonsView(isSimulationMode: $isSimulationMode)
        }
    }
}

struct ModeButtonStyle: ButtonStyle {
    var color: Color
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title3)
            .bold()
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(color)
            .cornerRadius(15)
            .padding(.horizontal, 10)
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}
