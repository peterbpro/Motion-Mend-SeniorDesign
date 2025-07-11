import asyncio
from bleak import BleakClient
import math
import time
from datetime import datetime

# Replace with your ESP32's UUID address on MAC and MAC address on Windows
ESP32_MAC_ADDRESS = "65DAA853-64CB-A387-AEE5-CDF0A60B786C"
# ESP32_MAC_ADDRESS = "14:2B:2F:AF:81:96"

# UUIDs for the UART service and characteristics (must match the ESP32's)
SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
CHARACTERISTIC_UUID_TX = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"  # Notify characteristic

timestamp_0 = None
FILENAME_SUFFIX = datetime.today().strftime('%Y_%m_%d_%H_%M')
FILE_HEADER = '''DataType=Quaternion
endheader'''

femur_l_roll, femur_l_pitch, femur_l_yaw = 0.0, 0.0, 0.0
femur_l_w, femur_l_x, femur_l_y, femur_l_z = 0.0, 0.0, 0.0, 0.0
        
tibia_l_roll, tibia_l_pitch, tibia_l_yaw = 0.0, 0.0, 0.0
tibia_l_w, tibia_l_x, tibia_l_y, tibia_l_z = 0.0, 0.0, 0.0, 0.0

pelvis_roll, pelvis_pitch, pelvis_yaw = 0.0, 0.0, 0.0
pelvis_w, pelvis_x, pelvis_y, pelvis_z = 0.0, 0.0, 0.0, 0.0

# Function to convert Roll, Pitch, Yaw to Quaternion
def rpy_to_quaternion(roll, pitch, yaw):
    # Convert angles to radians
    roll = math.radians(roll)
    pitch = math.radians(pitch)
    yaw = math.radians(yaw)

    # Quaternion conversion
    q_w = math.cos(roll/2) * math.cos(pitch/2) * math.cos(yaw/2) + math.sin(roll/2) * math.sin(pitch/2) * math.sin(yaw/2)
    q_x = math.sin(roll/2) * math.cos(pitch/2) * math.cos(yaw/2) - math.cos(roll/2) * math.sin(pitch/2) * math.sin(yaw/2)
    q_y = math.cos(roll/2) * math.sin(pitch/2) * math.cos(yaw/2) + math.sin(roll/2) * math.cos(pitch/2) * math.sin(yaw/2)
    q_z = math.cos(roll/2) * math.cos(pitch/2) * math.sin(yaw/2) - math.sin(roll/2) * math.sin(pitch/2) * math.cos(yaw/2)

    return q_w, q_x, q_y, q_z

# Callback function to handle incoming data from ESP32
def notification_handler(sender, data):
    try:
        # Decode incoming data (need to add encoding on ESP32 side)
        decoded_data = data.decode('utf-8').strip()

        # Split the incoming data by comma
        values = decoded_data.split(',')

        # Ensure the data length is a multiple of 3 (roll, pitch, yaw) and contains 5 sets of this data
        if len(values) % 3 != 0 or len(values) != 9:
            print(f"Unexpected data format: {decoded_data}")
            return
        
        global timestamp_0
        global femur_l_roll, femur_l_pitch, femur_l_yaw
        global femur_l_w, femur_l_x, femur_l_y, femur_l_z
        global tibia_l_roll, tibia_l_pitch, tibia_l_yaw
        global tibia_l_w, tibia_l_x, tibia_l_y, tibia_l_z
        
        global pelvis_roll, pelvis_pitch, pelvis_yaw
        global pelvis_w, pelvis_x, pelvis_y, pelvis_z
        
        first_run = False
        if timestamp_0 is None:
            first_run = True
            timestamp_0 = time.time()
        timestamp = time.time() - timestamp_0
        
        # Open the .sto file in append mode
        with open(f'data_{FILENAME_SUFFIX}.sto', 'a') as file:
            with open(f'data_raw_{FILENAME_SUFFIX}.txt', 'a') as file_raw:
                file.write(f"{timestamp:.3f}")
                file_raw.write(f"{timestamp:.3f}")
                
                # Iterate through each IMU set of data
                for i in range(0, len(values), 3):        
                    roll = float(values[i])
                    pitch = float(values[i + 1])
                    yaw = float(values[i + 2])
                    
                    # Convert RPY to quaternion
                    q_w, q_x, q_y, q_z = rpy_to_quaternion(roll, pitch, yaw)
                    
                    
                    # if i == 0:
                    #     if first_run:
                    #         pelvis_roll, pelvis_pitch, pelvis_yaw = roll, pitch, yaw
                    #         pelvis_w, pelvis_x, pelvis_y, pelvis_z = q_w, q_x, q_y, q_z
                    
                    #     roll, pitch, yaw = pelvis_roll, pelvis_pitch, pelvis_yaw
                    #     q_w, q_x, q_y, q_z = pelvis_w, pelvis_x, pelvis_y, pelvis_z

                    # Append quaternion data to the file
                    file.write(f"\t{q_w:.6f},{q_x:.6f},{q_y:.6f},{q_z:.6f}")
                    
                    # Append raw data to the file_raw
                    file_raw.write(f"\t{roll:.6f},{pitch:.6f},{yaw:.6f}")
                    
                    
                    if i == 3 and first_run:
                        femur_l_roll, femur_l_pitch, femur_l_yaw = roll, pitch, yaw
                        femur_l_w, femur_l_x, femur_l_y, femur_l_z = q_w, q_x, q_y, q_z
                    
                    if i == 6 and first_run:
                        tibia_l_roll, tibia_l_pitch, tibia_l_yaw = roll, pitch, yaw
                        tibia_l_w, tibia_l_x, tibia_l_y, tibia_l_z = q_w, q_x, q_y, q_z

                file.write(f"\t{femur_l_w:.6f},{femur_l_x:.6f},{femur_l_y:.6f},{femur_l_z:.6f}")
                file_raw.write(f"\t{femur_l_roll:.6f},{femur_l_pitch:.6f},{femur_l_yaw:.6f}")
                
                file.write(f"\t{tibia_l_w:.6f},{tibia_l_x:.6f},{tibia_l_y:.6f},{tibia_l_z:.6f}")
                file_raw.write(f"\t{tibia_l_roll:.6f},{tibia_l_pitch:.6f},{tibia_l_yaw:.6f}")
                
                file.write("\n")  # Newline after each set of IMU data
                file_raw.write("\n")  # Newline after each set of IMU data

                # Print for verification
                print(f"Data written for time {timestamp:.3f}")

    except ValueError as e:
        print(f"Error parsing data: {data}. Error: {e}")

async def run():
    async with BleakClient(ESP32_MAC_ADDRESS) as client:
        # Check if the ESP32 is connected
        connected = await client.is_connected()
        print(f"Connected: {connected}")

        # Start receiving notifications from the ESP32
        await client.start_notify(CHARACTERISTIC_UUID_TX, notification_handler)

        # Initialize the data.sto file with a header to store quertanion values
        with open(f'data_{FILENAME_SUFFIX}.sto', 'w') as file:
            
            # Header with time and the 5 IMUs placed at pelvis, right femur, right tibia, left femur, left tibia
            file.write(f"{FILE_HEADER}\ntime\tpelvis_imu\tfemur_r_imu\ttibia_r_imu\tfemur_l_imu\ttibia_l_imu\n")

        # Initialize the data_raw.txt file wit a header to store raw RPY values
        with open(f'data_raw_{FILENAME_SUFFIX}.txt', 'w') as file:
            
            # Header with time and the 5 IMUs placed at pelvis, right femur, right tibia, left femur, left tibia
            file.write("time\tpelvis_imu\tfemur_r_imu\ttibia_r_imu\tfemur_l_imu\ttibia_l_imu\n")
            
        # Keep the script running to listen for data
        print("Waiting for notifications...")
        await asyncio.sleep(30)  # Run for 1 min 

        # Stop receiving notifications
        await client.stop_notify(CHARACTERISTIC_UUID_TX)

# Run the asyncio loop
asyncio.run(run())
