import matplotlib.pyplot as plt
import opensim as osim
from bleak import BleakClient
from datetime import datetime
from math import pi
import os, math, time
import asyncio
from pathlib import Path


################################# VARIABLE SETUP ################################################
FILEPATH = os.path.dirname(__file__)
BLE_DURATION_SECONDS = 20
CAPTURE_NEW_DATA = True # False if you want to visualize the latest motion captured
RECALIBRATE = False

### BLUETOOTH VARIABLES ###
ESP32_MAC_ADDRESS = "65DAA853-64CB-A387-AEE5-CDF0A60B786C"
ESP32_MAC_ADDRESS = "14:2B:2F:AF:81:96"
ESP32_MAC_ADDRESS = "14:2B:2F:AE:BC:86"
SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
CHARACTERISTIC_UUID_TX = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
FILENAME_SUFFIX = datetime.today().strftime('%Y_%m_%d_%H_%M')
FILE_HEADER = '''DataType=Quaternion
endheader'''
STO_FILENAME = os.path.join(FILEPATH, 'data', f'data_{FILENAME_SUFFIX}.sto')
RAW_DATA_FILENAME = os.path.join(FILEPATH, 'data', f'data_raw_{FILENAME_SUFFIX}.txt')
### SIMULATION FILE PATH VARIABLES ###
modelFileName = os.path.join(FILEPATH, 'models','Rajagopal_2015.osim')          # The path to an input model
outputCalibratedFileName = os.path.join(FILEPATH, 'models', 'calibrated_model.osim')
resultsDirectory = os.path.join(FILEPATH, 'IK_results')
MOT_FILENAME = os.path.join(resultsDirectory, f'ik_data_{FILENAME_SUFFIX}.mot')
timestamp = time.time()
### CALIBRATION VARIABLES ###
sensor_to_opensim_rotations = osim.Vec3(-pi/2, 0, 0)# The rotation of IMU data to the OpenSim world frame
baseIMUName = 'pelvis_imu'                     # The base IMU is the IMU on the base body of the model that dictates the heading (forward) direction of the model.
baseIMUHeading = '-z'                           # The Coordinate Axis of the base IMU that points in the heading direction. 
visulizeCalibration = False                     # Boolean to Visualize the Output model

### INVERSE KINEMATICS VARIABLES ###
sensor_to_opensim_rotation = osim.Vec3(-pi/2, 0, 0) # The rotation of IMU data to the OpenSim world frame
visualizeTracking = True  # Boolean to Visualize the tracking simulation
startTime = 0           # Start time (in seconds) of the tracking simulation. 
endTime = 1000              # End time (in seconds) of the tracking simulation.

################################# BLUETOOTH DATA ACQUISITION ################################################

imuIK = osim.IMUInverseKinematicsTool()
 
# Set tool properties
imuIK.set_model_file(outputCalibratedFileName)
imuIK.set_sensor_to_opensim_rotations(sensor_to_opensim_rotation)
imuIK.set_results_directory(resultsDirectory)

# Set time range in seconds
imuIK.set_time_range(0, startTime) 
imuIK.set_time_range(1, endTime)   

model = osim.Model(outputCalibratedFileName)

relevant_coords = set([
    # 'hip_flexion_r',
    # 'hip_adduction_r',
    # 'hip_rotation_r',
    'knee_angle_r',
    'knee_angle_r_beta',
    # 'hip_flexion_l',
    # 'hip_adduction_l',
    # 'hip_rotation_l',
    # 'knee_angle_l',
    # 'knee_angle_l_beta'
])

tibia0, femur0 = 6, 11
angles = []
timestamp0 = None
counter = 0
AVG_CALIBRATION = 10
avgtibia = []
avgfemur = []
# Callback function to handle incoming data from ESP32
def notification_handler(sender, data):
    try:
        # Decode incoming data (need to add encoding on ESP32 side)
        decoded_data = data.decode('utf-8').strip()

        # Split the incoming data by comma
        values = decoded_data.split(',')
        
        global timestamp0, counter, femur0, tibia0
        
        femur, tibia = 0, 0
        
        # Iterate through each IMU set of data
        for i in range(0, len(values), 3):        
            roll = float(values[i])
            pitch = float(values[i + 1])        
            
            if i == 3:
                femur = pitch
            if i == 6:
                tibia = pitch
            if i > 0:
                print(f'{"femur" if i == 3 else "tibia"}: {roll}, {pitch}')
                
        if counter < AVG_CALIBRATION:
            if counter == 0:
                print('Calibrating, please stand still')
            avgfemur.append(femur)
            avgtibia.append(tibia)
            counter += 1
        elif counter == AVG_CALIBRATION:
            tibia0 = sum(avgtibia) / len(avgtibia)
            femur0 = sum(avgfemur) / len(avgfemur)
            counter += 1
        else:
            print(f'tibia0: {tibia0}; femur0: {femur0}')
            ang = (femur0 - femur) - (tibia0 - tibia)      
            print(f'computed angle: {ang}')
            angles.append((time.time() - timestamp0, ang))

    except ValueError as e:
        print(f"Error parsing data: {data}. Error: {e}")

async def run():
    async with BleakClient(ESP32_MAC_ADDRESS) as client:
        connected = await client.is_connected()
        print(f"Connected: {connected}")
        global timestamp0
        timestamp0 = time.time()

        await client.start_notify(CHARACTERISTIC_UUID_TX, notification_handler)

        await asyncio.sleep(BLE_DURATION_SECONDS)  # Run for 1 min 

        await client.stop_notify(CHARACTERISTIC_UUID_TX)

# Run the loop
asyncio.run(run())


# Separate the tuples into two lists: time and value
time, value = zip(*angles)

# Create the plot
plt.figure(figsize=(8, 5))
plt.plot(time, value, marker='o', linestyle='-', label='Angle over Time')

# Add labels and title
plt.xlabel('Time')
plt.ylabel('Angle')
plt.title('Time vs. Angle Plot')

# Add a legend
plt.legend()

# Show the plot
plt.grid(True)
plt.show()


