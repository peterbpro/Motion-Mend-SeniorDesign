import opensim as osim
from math import pi
import os

### FILE PATH VARIABLES ###
FILEPATH = os.path.dirname(__file__)
modelFileName = os.path.join(FILEPATH, 'models','Rajagopal_2015.osim')          # The path to an input model
outputCalibratedFileName = os.path.join(FILEPATH, 'models', 'calibrated_model.osim')
orientationsFileName = os.path.join(FILEPATH, 'data', 'data_2024_11_06_17_43.sto')   # The path to orientation data for calibration 
resultsDirectory = os.path.join(FILEPATH, 'IK_results')

### CALIBRATION VARIABLES ###
sensor_to_opensim_rotations = osim.Vec3(-pi/2, 0, 0)# The rotation of IMU data to the OpenSim world frame
baseIMUName = 'pelvis_imu'                     # The base IMU is the IMU on the base body of the model that dictates the heading (forward) direction of the model.
baseIMUHeading = 'z'                           # The Coordinate Axis of the base IMU that points in the heading direction. 
visulizeCalibration = False                     # Boolean to Visualize the Output model

### INVERSE KINEMATICS VARIABLES ###
sensor_to_opensim_rotation = osim.Vec3(-pi/2, 0, 0) # The rotation of IMU data to the OpenSim world frame
visualizeTracking = True  # Boolean to Visualize the tracking simulation
startTime = 0           # Start time (in seconds) of the tracking simulation. 
endTime = 1000              # End time (in seconds) of the tracking simulation.

################################### IMU PLACER CALIBRATION ##################################################

# Instantiate an IMUPlacer object
imuPlacer = osim.IMUPlacer()

# Set properties for the IMUPlacer
imuPlacer.set_model_file(modelFileName)
imuPlacer.set_orientation_file_for_calibration(orientationsFileName)
imuPlacer.set_sensor_to_opensim_rotations(sensor_to_opensim_rotations)
imuPlacer.set_base_imu_label(baseIMUName)
imuPlacer.set_base_heading_axis(baseIMUHeading)

# Run the IMUPlacer
imuPlacer.run(visulizeCalibration)

# Get the model with the calibrated IMU
model = imuPlacer.getCalibratedModel()

# Print the calibrated model to file.
model.printToXML(outputCalibratedFileName)

################################### INVERSE KINEMATICS ##################################################

# Instantiate an InverseKinematicsTool
imuIK = osim.IMUInverseKinematicsTool()
 
# Set tool properties
imuIK.set_model_file(outputCalibratedFileName)
imuIK.set_orientations_file(orientationsFileName)
imuIK.set_sensor_to_opensim_rotations(sensor_to_opensim_rotation)
imuIK.set_results_directory(resultsDirectory)

# Set time range in seconds
imuIK.set_time_range(0, startTime) 
imuIK.set_time_range(1, endTime)   

# Run IK
imuIK.run(visualizeTracking)