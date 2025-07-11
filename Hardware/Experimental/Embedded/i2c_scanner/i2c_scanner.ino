#include <Wire.h>
#include "Kalman.h" // Source: https://github.com/TKJElectronics/KalmanFilter
#include <Adafruit_Sensor.h>
#include <Adafruit_ICM20X.h>
#include <Adafruit_ICM20948.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "ICM_20948.h"

// BLE setup
#define SERVICE_UUID           "425e1692-eb2f-4606-bb0c-33717b8e72c6" // UART service UUID
#define CHARACTERISTIC_UUID_RX "425e1692-eb2f-4606-bb0c-33717b8e72c7"
#define CHARACTERISTIC_UUID_TX "425e1692-eb2f-4606-bb0c-33717b8e72c8"

#define RESTRICT_PITCH // Comment out to restrict roll to ±90deg instead - please read: http://www.freescale.com/files/sensors/doc/app_note/AN3461.pdf
#define WIRE_PORT Wire
#define USE_IMU 1
#define IMU_ADDR 0x68

#define USR_LED 2
#define RED_LED 10
#define GREEN_LED 4
#define BLUE_LED 5
#define BAT_MEAS 3

BLEServer *pServer = NULL;
BLECharacteristic *pTxCharacteristic;
bool deviceConnected = false;
bool oldDeviceConnected = false;
 
 
// BLE Server callbacks
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

// BLE characteristic callbacks for receiving data
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        Serial.println("*********");
        Serial.print("Received Value: ");
        for (int i = 0; i < rxValue.length(); i++) {
          Serial.print(rxValue[i]);
        }
        Serial.println();
        Serial.println("*********");
      }
    }
};

void setup()
{
  Wire.begin(6, 7);
 
  Serial.begin(9600);
  while (!Serial);             // Leonardo: wait for serial monitor
  Serial.println("\nI2C Scanner");

  pinMode(2, OUTPUT);

  // Initialize BLE
  Serial.print("BLE");
  BLEDevice::init("ESP32_IMU_BLE_1");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create a BLE characteristic for transmitting data
  pTxCharacteristic = pService->createCharacteristic(
                                        CHARACTERISTIC_UUID_TX,
                                        BLECharacteristic::PROPERTY_NOTIFY
                                    );
  pTxCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
                                        CHARACTERISTIC_UUID_RX,
                                        BLECharacteristic::PROPERTY_WRITE
                                    );
  pRxCharacteristic->setCallbacks(new MyCallbacks());

  pService->start();
  pServer->getAdvertising()->start();
}
 
 
void loop()
{
  byte error, address;
  int nDevices;
 
  String s = "Devices\n";
  Serial.println("Scanning...");
 
  nDevices = 0;
  for(address = 104; address < 106; address++ )
  {
    // The i2c_scanner uses the return value of
    // the Write.endTransmisstion to see if
    // a device did acknowledge to the address.
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
 
    if (error == 0)
    {
      Serial.print("I2C device found at address 0x");
      if (address<16)
        Serial.print("0");
      Serial.print(address,HEX);
      Serial.println("  !");

      s += address;
      s += ',';

      if (address == 0x68) {
        digitalWrite(2, HIGH);
      }
      else digitalWrite(2, LOW);
 
      nDevices++;
    }
    else if (error==4)
    {
      Serial.print("Unknown error at address 0x");
      if (address<16)
        Serial.print("0");
      Serial.println(address,HEX);
    }    
  }
  if (nDevices == 0)
    Serial.println("No I2C devices found\n");
  else
    Serial.println("done\n");

    // Send the data via BLE
  if (deviceConnected) {
    pTxCharacteristic->setValue(s.c_str()); // Convert string to char array for BLE
    pTxCharacteristic->notify(); // Notify connected device
    delay(20); // Small delay to avoid congestion
  }

  // Manage BLE connection state
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // Give BLE stack a chance to reset
    pServer->startAdvertising(); // Restart advertising
    oldDeviceConnected = deviceConnected;
  }

  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }
 
  delay(2000);           // wait 5 seconds for next scan
}