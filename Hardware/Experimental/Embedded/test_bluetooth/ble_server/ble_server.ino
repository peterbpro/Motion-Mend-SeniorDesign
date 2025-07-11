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
#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E" // UART service UUID
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

#define RESTRICT_PITCH // Comment out to restrict roll to ±90deg instead - please read: http://www.freescale.com/files/sensors/doc/app_note/AN3461.pdf
#define N_IMUS 2
#define WIRE_PORT Wire

BLEServer *pServer = NULL;
BLECharacteristic *pTxCharacteristic;
bool deviceConnected = false;
bool oldDeviceConnected = false;

const uint8_t IMUAddress = 0x68; // AD0 is logic low on the PCB
const uint16_t I2C_TIMEOUT = 1000; // Used to check for errors in I2C communication

uint8_t i2cWrite(uint8_t registerAddress, uint8_t data, bool sendStop) {
  return i2cWrite(registerAddress, &data, 1, sendStop); // Returns 0 on success
}

uint8_t i2cWrite(uint8_t registerAddress, uint8_t *data, uint8_t length, bool sendStop) {
  Wire.beginTransmission(IMUAddress);
  Wire.write(registerAddress);
  Wire.write(data, length);
  uint8_t rcode = Wire.endTransmission(sendStop); // Returns 0 on success
  if (rcode) {
    Serial.print(F("i2cWrite failed: "));
    Serial.println(rcode);
  }
  return rcode; // See: http://arduino.cc/en/Reference/WireEndTransmission
}

uint8_t i2cRead(uint8_t registerAddress, uint8_t *data, uint8_t nbytes) {
  uint32_t timeOutTimer;
  Wire.beginTransmission(IMUAddress);
  Wire.write(registerAddress);
  uint8_t rcode = Wire.endTransmission(false); // Don't release the bus
  if (rcode) {
    Serial.print(F("i2cRead failed: "));
    Serial.println(rcode);
    return rcode; // See: http://arduino.cc/en/Reference/WireEndTransmission
  }
  Wire.requestFrom(IMUAddress, nbytes, (uint8_t)true); // Send a repeated start and then release the bus after reading
  for (uint8_t i = 0; i < nbytes; i++) {
    if (Wire.available())
      data[i] = Wire.read();
    else {
      timeOutTimer = micros();
      while (((micros() - timeOutTimer) < I2C_TIMEOUT) && !Wire.available());
      if (Wire.available())
        data[i] = Wire.read();
      else {
        Serial.println(F("i2cRead timeout"));
        return 5; // This error value is not already taken by endTransmission
      }
    }
  }
  return 0; // Success
}

// basic vector operations
void vector_cross(float a[3], float b[3], float out[3])
{
  out[0] = a[1] * b[2] - a[2] * b[1];
  out[1] = a[2] * b[0] - a[0] * b[2];
  out[2] = a[0] * b[1] - a[1] * b[0];
}

float vector_dot(float a[3], float b[3])
{
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

void vector_normalize(float a[3])
{
  float mag = sqrt(vector_dot(a, a));
  a[0] /= mag;
  a[1] /= mag;
  a[2] /= mag;
}

// Returns a heading (in degrees) given an acceleration vector a due to gravity, a magnetic vector m, and a facing vector p.
// applies magnetic declination
int get_heading(float acc[3], float mag[3], float p[3], float magdec)
{
  float W[3], N[3]; //derived direction vectors

  // cross "Up" (acceleration vector, g) with magnetic vector (magnetic north + inclination) with  to produce "West"
  vector_cross(acc, mag, W);
  vector_normalize(W);

  // cross "West" with "Up" to produce "North" (parallel to the ground)
  vector_cross(W, acc, N);
  vector_normalize(N);

  // compute heading in horizontal plane, correct for local magnetic declination in degrees

  float h = -atan2(vector_dot(W, p), vector_dot(N, p)) * 180 / M_PI; //minus: conventional nav, heading increases North to East
  int heading = round(h + magdec);
  heading = (heading + 720) % 360; //apply compass wrap
  return heading;
}

void set_multiplexer(uint8_t mux_channel) {
  if (mux_channel > 3) return;
 
  Wire.beginTransmission(0x70);
  Wire.write(1 << mux_channel);
  Wire.endTransmission();  
}

class IMU {
public:
  uint8_t multiplexerChannel;
  uint8_t i2c_addr;
  unsigned long timer;

  Kalman kalmanX;
  Kalman kalmanY;
  Kalman kalmanZ;

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

  // YAW
  ICM_20948_I2C yaw_imu;
  //Accel scale: divide by 16604.0 to normalize. These corrections are quite small and probably can be ignored.
  float A_B[3]
  {   79.60,  -18.56,  383.31};

  float A_Ainv[3][3]
  { {  1.00847,  0.00470, -0.00428},
    {  0.00470,  1.00846, -0.00328},
    { -0.00428, -0.00328,  0.99559}
  };
  //Mag scale divide by 369.4 to normalize. These are significant corrections, especially the large offsets.
  float M_B[3] {  -46.32,  -45.84,   58.89};
  // { -156.70,  -52.79, -141.07};

  float M_Ainv[3][3] {{  1.01888, -0.01533,  0.00892},
    { -0.01533,  0.95221,  0.00495},
    {  0.00892,  0.00495,  0.95868}};
  float declination = -11.85;
  float p[3] = {1, 0, 0};

  IMU(uint8_t multiplexerChannel, uint8_t i2c_addr) :
    multiplexerChannel(multiplexerChannel),
    i2c_addr(i2c_addr)
  {icm=new Adafruit_ICM20948();}
  
  bool init() {
    Serial.print(this->i2c_addr);
    set_multiplexer(this->multiplexerChannel);
    delay(50);
    if (!this->icm->begin_I2C(this->i2c_addr)) {
      return false;
    }
    Serial.print("a");
    this->icm->enableAccelDLPF(true, ICM20X_ACCEL_FREQ_5_7_HZ);
    this->icm_temp = this->icm->getTemperatureSensor();
    this->icm_accel = this->icm->getAccelerometerSensor();
    this->icm_gyro = this->icm->getGyroSensor();
    this->icm_mag = this->icm->getMagnetometerSensor();
    Serial.print("b");

    this->yaw_imu.begin(WIRE_PORT, this->i2c_addr == 0x68 ? 0 : 1);
    while (this->yaw_imu.status != ICM_20948_Stat_Ok) {
      Serial.println(F("ICM_90248 not detected"));
      delay(50);
      this->yaw_imu.begin(WIRE_PORT, this->i2c_addr == 0x68 ? 0 : 1);
    }
    Serial.print("bb");
    delay(50);  
    this->refresh_values(); 
    Serial.print("c");

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

  // subtract offsets and correction matrix to accel and mag data
  void get_scaled_IMU(float Axyz[3], float Mxyz[3]) {
    byte i;
    float temp[3];
    Axyz[0] = this->yaw_imu.agmt.acc.axes.x;
    Axyz[1] = this->yaw_imu.agmt.acc.axes.y;
    Axyz[2] = this->yaw_imu.agmt.acc.axes.z;
    Mxyz[0] = this->yaw_imu.agmt.mag.axes.x;
    Mxyz[1] = this->yaw_imu.agmt.mag.axes.y;
    Mxyz[2] = this->yaw_imu.agmt.mag.axes.z;
    //apply offsets (bias) and scale factors from Magneto
    for (i = 0; i < 3; i++) temp[i] = (Axyz[i] - this->A_B[i]);
    Axyz[0] = A_Ainv[0][0] * temp[0] + A_Ainv[0][1] * temp[1] + A_Ainv[0][2] * temp[2];
    Axyz[1] = A_Ainv[1][0] * temp[0] + A_Ainv[1][1] * temp[1] + A_Ainv[1][2] * temp[2];
    Axyz[2] = A_Ainv[2][0] * temp[0] + A_Ainv[2][1] * temp[1] + A_Ainv[2][2] * temp[2];
    vector_normalize(Axyz);

    //apply offsets (bias) and scale factors from Magneto
    for (int i = 0; i < 3; i++) temp[i] = (Mxyz[i] - this->M_B[i]);
    Mxyz[0] = M_Ainv[0][0] * temp[0] + M_Ainv[0][1] * temp[1] + M_Ainv[0][2] * temp[2];
    Mxyz[1] = M_Ainv[1][0] * temp[0] + M_Ainv[1][1] * temp[1] + M_Ainv[1][2] * temp[2];
    Mxyz[2] = M_Ainv[2][0] * temp[0] + M_Ainv[2][1] * temp[1] + M_Ainv[2][2] * temp[2];
    vector_normalize(Mxyz);
  }

  void refresh_values() {
    sensors_event_t accel;
    sensors_event_t gyro;
    sensors_event_t temp;
    sensors_event_t mag;
    set_multiplexer(this->multiplexerChannel);
    delay(2);
    this->icm_temp->getEvent(&temp);
    this->icm_accel->getEvent(&accel);
    this->icm_gyro->getEvent(&gyro);
    this->icm_mag->getEvent(&mag);

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

    float Axyz[3], Mxyz[3];
    if ( this->yaw_imu.dataReady() ) this->yaw_imu.getAGMT();
    get_scaled_IMU(Axyz, Mxyz);
    Mxyz[1] = -Mxyz[1]; //align magnetometer with accelerometer (reflect Y and Z)
    Mxyz[2] = -Mxyz[2];

    // this->yaw = get_heading(Axyz, Mxyz, this->p, this->declination);
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

IMU imu1(1, 0x69); // back
IMU imu2(0, 0x69); // right hip
IMU imu3(0, 0x68); // right leg
IMU imu4(2, 0x69); // left hip
IMU imu5(3, 0x69); // left leg

IMU imus[] = {imu1, imu2, imu3, imu4, imu5};
int n_imus = 3;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  #if ARDUINO >= 157
    Wire.setClock(400000UL); // Set I2C frequency to 400kHz
  #else
    TWBR = ((F_CPU / 400000UL) - 16) / 2; // Set I2C frequency to 400kHz
  #endif

  // Initialize BLE
  BLEDevice::init("ESP32_IMU_BLE");
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

  // Initialize IMUs
  for (int i = 0; i < n_imus; i++) {
    Serial.print("Initializing IMU number ");
    Serial.println(i);
    imus[i].init();
  }
}

void loop() {  
  String imuData = "";

  for (int i = 0; i < n_imus; i++) {
    imus[i].update_angle();
    
    // Add the IMU data to the string for BLE transmission
    imuData += String(imus[i].kalAngleX) + ',';
    imuData += String(imus[i].kalAngleY) + ',';
    imuData += String(imus[i].yaw);
    if (i < n_imus - 1) imuData += ",";

    // // Print data to the serial monitor
    // Serial.print(imus[i].kalAngleY);
  }
  // Serial.println(imuData);

  // Send the data via BLE
  if (deviceConnected) {
    pTxCharacteristic->setValue(imuData.c_str()); // Convert string to char array for BLE
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

  // delay(5); // Slight delay as per original code
}
