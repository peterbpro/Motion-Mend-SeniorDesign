import asyncio
from bleak import BleakClient

# Replace with your ESP32's UUID address on MAC and MAC address on Windows
ESP32_MAC_ADDRESS = "D8:3B:DA:E5:64:96" # bought soc c3 
ESP32_MAC_ADDRESS = "CC:BA:97:4B:9E:A6" # second pcb
ESP32_MAC_ADDRESS = "E4:B3:23:CF:48:32" # first pcb
ESP32_MAC_ADDRESS = "E4:B3:23:D0:29:56" #debugging #COM3
ESP32_MAC_ADDRESS = "E4:B3:23:D2:C1:4A" #debugging #COM5
ESP32_MAC_ADDRESS = "E4:B3:23:D2:C2:22" #debugging #COM4



# UUIDs for the UART service and characteristics (must match the ESP32's)
SERVICE_UUID = "425e1692-eb2f-4606-bb0c-33717b8e72c6"
CHARACTERISTIC_UUID_TX = "425e1692-eb2f-4606-bb0c-33717b8e72c8"  # Notify characteristic

# Callback function to handle incoming data from ESP32
def notification_handler(sender, data):
    print(f"Received data: {data.decode('utf-8')}")

async def run():
    async with BleakClient(ESP32_MAC_ADDRESS) as client:
        # Check if the ESP32 is connected
        connected = await client.is_connected()
        print(f"Connected: {connected}")

        # Start receiving notifications from the ESP32
        await client.start_notify(CHARACTERISTIC_UUID_TX, notification_handler)

        # Keep the script running to listen for data
        print("Waiting for notifications...")
        await asyncio.sleep(60)  # Run for 60 seconds (you can adjust this)

        # Stop receiving notifications
        await client.stop_notify(CHARACTERISTIC_UUID_TX)

# Run the asyncio loop
asyncio.run(run())
