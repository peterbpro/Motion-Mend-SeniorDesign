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

#define IMU_NUM 2
#define IMU_RED 1.f // Value from 0 - 1
#define IMU_GREEN 0.f // Value from 0 - 1

// BLE setup
#define SERVICE_UUID           "425e1692-eb2f-4606-bb0c-33717b8e72c6"
#define CHARACTERISTIC_UUID_RX "425e1692-eb2f-4606-bb0c-33717b8e72c7"
#define CHARACTERISTIC_UUID_TX "425e1692-eb2f-4606-bb0c-33717b8e72c8"

#define RESTRICT_PITCH // Comment out to restrict roll to ±90deg instead - please read: http://www.freescale.com/files/sensors/doc/app_note/AN3461.pdf
#define WIRE_PORT Wire
#define IMU_ADDR 0x69

#define USR_LED 2
#define RED_LED 10
#define GREEN_LED 4
#define BAT_MEAS 3

#define LOW_BAT 3.6
#define BAT_WARNING_PERIOD_SECONDS 1

BLEServer *pServer = NULL;
BLECharacteristic *pTxCharacteristic;
bool deviceConnected = false;
bool oldDeviceConnected = false;
unsigned long last_toggle = millis();
bool toggle_on = true;

float get_vbat() {
  int read = analogRead(BAT_MEAS);

  // 12 bit ADC with 3V ref, with a voltage divider of 2
  return read / 4095.f * 3.109f * 2; 
}

class IMU {
public:
  uint8_t i2c_addr;
  unsigned long timer;

  Kalman kalmanX;
  Kalman kalmanY;

  /* IMU Data */
  double accX, accY, accZ;
  double gyroX, gyroY, gyroZ;
  double magX, magY, magZ;
  int16_t tempRaw;
  int yaw;

  double gyroXangle, gyroYangle, gyroZangle; // Angle calculate using the gyro only
  double compAngleX, compAngleY, compAngleZ; // Calculated angle using a complementary filter
  double kalAngleX, kalAngleY, kalAngleZ; // Calculated angle using a Kalman filter

  Adafruit_ICM20948 *icm;
  Adafruit_Sensor *icm_temp, *icm_accel, *icm_gyro, *icm_mag;

  IMU(uint8_t i2c_addr) :
    i2c_addr(i2c_addr)
  {icm=new Adafruit_ICM20948();}
  
  bool init() {
    delay(50);
    if (!this->icm->begin_I2C(this->i2c_addr)) {
      return false;
    }
    this->icm->enableAccelDLPF(true, ICM20X_ACCEL_FREQ_5_7_HZ);

    delay(50);  
    this->refresh_values(); 

    #ifdef RESTRICT_PITCH // Eq. 25 and 26
      double roll  = atan2(this->accY, this->accZ) * RAD_TO_DEG;
      double pitch = atan(-this->accX / sqrt(this->accY * this->accY + this->accZ * this->accZ)) * RAD_TO_DEG;
    #else // Eq. 28 and 29
      double roll  = atan(this->accY / sqrt(this->accX * this->accX + this->accZ * this->accZ)) * RAD_TO_DEG;
      double pitch = atan2(-this->accX, this->accZ) * RAD_TO_DEG;
    #endif

    double adjustedMagX = this->magX * cos(pitch) + this->magZ * sin(pitch);
    double adjustedMagY = (this->magX * sin(roll) * sin(pitch)) + 
                          (this->magY * cos(roll)) - 
                          (this->magZ * sin(roll) * cos(pitch));

    this->kalmanX.setAngle(roll); // Set starting angle
    this->kalmanY.setAngle(pitch);
    this->gyroXangle = roll;
    this->gyroYangle = pitch;
    this->compAngleX = roll;
    this->compAngleY = pitch;
    this->timer = micros();

    return true;
  }  

  void refresh_values() {
    sensors_event_t accel;
    sensors_event_t gyro;
    sensors_event_t mag;
    sensors_event_t temp;
    this->icm->getEvent(&accel, &gyro, &temp, &mag);

    this->tempRaw = temp.temperature;
    this->accX = accel.acceleration.x;
    this->accY = accel.acceleration.y;
    this->accZ = accel.acceleration.z;

    this->gyroX = gyro.gyro.x;
    this->gyroY = gyro.gyro.y;
    this->gyroZ = gyro.gyro.z;

    this->magX = mag.magnetic.x;
    this->magY = mag.magnetic.y;
    this->magZ = mag.magnetic.z;

    this->yaw = 0;
  }

  void update_angle() {
    this->refresh_values();

    double dt = (double)(micros() - this->timer) / 1000000; // Calculate delta time
    this->timer = micros();

    #ifdef RESTRICT_PITCH // Eq. 25 and 26
      double roll  = atan2(this->accY, this->accZ) * RAD_TO_DEG;
      double pitch = atan(-this->accX / sqrt(this->accY * this->accY + this->accZ * this->accZ)) * RAD_TO_DEG;
    #else // Eq. 28 and 29
      double roll  = atan(this->accY / sqrt(this->accX * this->accX + this->accZ * this->accZ)) * RAD_TO_DEG;
      double pitch = atan2(-this->accX, this->accZ) * RAD_TO_DEG;
    #endif

    double gyroXrate = this->gyroX / 131.0; // Convert to deg/s
    double gyroYrate = this->gyroY / 131.0; // Convert to deg/s
    double gyroZrate = this->gyroZ / 131.0; // Convert to deg/s

    #ifdef RESTRICT_PITCH
      // This fixes the transition problem when the accelerometer angle jumps between -180 and 180 degrees
      if ((roll < -90 && this->kalAngleX > 90) || (roll > 90 && this->kalAngleX < -90)) {
        this->kalmanX.setAngle(roll);
        this->compAngleX = roll;
        this->kalAngleX = roll;
        this->gyroXangle = roll;
      } else
        this->kalAngleX = this->kalmanX.getAngle(roll, gyroXrate, dt); // Calculate the angle using a Kalman filter

      if (abs(this->kalAngleX) > 90)
        gyroYrate = -gyroYrate; // Invert rate, so it fits the restriced accelerometer reading
      this->kalAngleY = this->kalmanY.getAngle(pitch, gyroYrate, dt);
    #else
      // This fixes the transition problem when the accelerometer angle jumps between -180 and 180 degrees
      if ((pitch < -90 && this->kalAngleY > 90) || (pitch > 90 && this->kalAngleY < -90)) {
        this->kalmanY.setAngle(pitch);
        this->compAngleY = pitch;
        this->kalAngleY = pitch;
        this->gyroYangle = pitch;
      } else
        this->kalAngleY = this->kalmanY.getAngle(pitch, gyroYrate, dt); // Calculate the angle using a Kalman filter

      if (abs(this->kalAngleY) > 90)
        gyroXrate = -gyroXrate; // Invert rate, so it fits the restriced accelerometer reading
      this->kalAngleX = this->kalmanX.getAngle(roll, gyroXrate, dt); // Calculate the angle using a Kalman filter
    #endif

    this->gyroXangle += gyroXrate * dt; // Calculate gyro angle without any filter
    this->gyroYangle += gyroYrate * dt;
    this->gyroZangle += gyroZrate * dt;

    this->compAngleX = 0.93 * (this->compAngleX + gyroXrate * dt) + 0.07 * roll; // Calculate the angle using a Complimentary filter
    this->compAngleY = 0.93 * (this->compAngleY + gyroYrate * dt) + 0.07 * pitch;

    // Reset the gyro angle when it has drifted too much
    if (this->gyroXangle < -180 || this->gyroXangle > 180)
      this->gyroXangle = this->kalAngleX;
    if (this->gyroYangle < -180 || this->gyroYangle > 180)
      this->gyroYangle = this->kalAngleY;
    if (this->gyroZangle < -180 || this->gyroZangle > 180)
      this->gyroZangle = this->kalAngleY;
  }

};

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
        // Serial.println("*********");
        // Serial.print("Received Value: ");
        for (int i = 0; i < rxValue.length(); i++) {
          // Serial.print(rxValue[i]);
        }
        // Serial.println();
        // Serial.println("*********");
      }
    }
};

// Sets RGB led to desired output. 
// Inputs range from 0 (fully off) to 1 (fully on)
// Blue is not available :(
void rgb(float r, float g) {
  // Get the complement since RGB LED is active low
  r = 1 - constrain(r, 0, 1);
  g = 1 - constrain(g, 0, 1);

  analogWrite(RED_LED, r * 255.f);
  analogWrite(GREEN_LED, g * 255.f);
}

void update_led() {
  if (get_vbat() > LOW_BAT || 1) {
    rgb(IMU_RED, IMU_GREEN);
  } else if (millis() - last_toggle > 1000 * BAT_WARNING_PERIOD_SECONDS) {
    toggle_on ? rgb(0, 0) : rgb(IMU_RED, IMU_GREEN);
    toggle_on != toggle_on;
    last_toggle = millis();
  }
}

IMU imu(IMU_ADDR);

void setup() {
  Wire.begin(6, 7);

  // Initialize IMU
  if (IMU_NUM > 0)
    imu.init();

  // Initialize BLE
  BLEDevice::init("ESP32_IMU_BLE_" + String(IMU_NUM));
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

  // Set I/Os
  pinMode(USR_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(BAT_MEAS, INPUT);

  update_led();
}

void loop() {  
  String imuData = "";

  if (IMU_NUM > 0) {
    imu.update_angle();
    
    // Add the IMU data to the string for BLE transmission
    imuData += String(imu.kalAngleX) + ',';
    imuData += String(imu.kalAngleY) + ',';
    imuData += String(imu.yaw);

    if (imu.kalAngleX > 0) digitalWrite(USR_LED, HIGH);
    else digitalWrite(USR_LED, LOW);
  }

  // Send the data via BLE
  if (deviceConnected) {
    pTxCharacteristic->setValue(imuData.c_str()); // Convert string to char array for BLE
    pTxCharacteristic->notify(); // Notify connected device
    delay(10); // Small delay to avoid congestion
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

  update_led();
}
