#include <Wire.h>
#include "Kalman.h" // Source: https://github.com/TKJElectronics/KalmanFilter
#include <Adafruit_Sensor.h>
#include <Adafruit_ICM20X.h>
#include <Adafruit_ICM20948.h>

#define RESTRICT_PITCH // Comment out to restrict roll to ±90deg instead - please read: http://www.freescale.com/files/sensors/doc/app_note/AN3461.pdf
#define N_IMUS 2

const uint8_t IMUAddress = 0x69; // AD0 is logic low on the PCB
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

void set_multiplexer(uint8_t mux_channel) {
  // if (mux_channel > 3) return;
 
  // Wire.beginTransmission(0x70);
  // Wire.write(1 << mux_channel);
  // Wire.endTransmission();  
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

  double gyroXangle, gyroYangle, gyroZangle; // Angle calculate using the gyro only
  double compAngleX, compAngleY, compAngleZ; // Calculated angle using a complementary filter
  double kalAngleX, kalAngleY, kalAngleZ; // Calculated angle using a Kalman filter

  Adafruit_ICM20948 *icm;
  Adafruit_Sensor *icm_temp, *icm_accel, *icm_gyro, *icm_mag;

  IMU(uint8_t multiplexerChannel, uint8_t i2c_addr) :
    multiplexerChannel(multiplexerChannel),
    i2c_addr(i2c_addr)
  {icm=new Adafruit_ICM20948();}
  
  bool init() {
    Serial.print(this->i2c_addr);
    // set_multiplexer(this->multiplexerChannel);
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

    // double yaw = atan2(adjustedMagY, adjustedMagX) * RAD_TO_DEG;

    this->kalmanX.setAngle(roll); // Set starting angle
    this->kalmanY.setAngle(pitch);
    // this->kalAngleZ.setAngle(yaw);
    this->gyroXangle = roll;
    this->gyroYangle = pitch;
    // this->gyroZangle = yaw;
    this->compAngleX = roll;
    this->compAngleY = pitch;
    // this->compAngleZ = yaw;
    this->timer = micros(); 
    
    return true;
  }

  void refresh_values() {
    sensors_event_t accel;
    sensors_event_t gyro;
    sensors_event_t temp;
    sensors_event_t mag;
    // set_multiplexer(this->multiplexerChannel);
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
    //gyroXangle += kalmanX.getRate() * dt; // Calculate gyro angle using the unbiased rate
    //gyroYangle += kalmanY.getRate() * dt;

    this->compAngleX = 0.93 * (this->compAngleX + gyroXrate * dt) + 0.07 * roll; // Calculate the angle using a Complimentary filter
    this->compAngleY = 0.93 * (this->compAngleY + gyroYrate * dt) + 0.07 * pitch;

    // Reset the gyro angle when it has drifted too much
    if (this->gyroXangle < -180 || this->gyroXangle > 180)
      this->gyroXangle = this->kalAngleX;
    if (this->gyroYangle < -180 || this->gyroYangle > 180)
      this->gyroYangle = this->kalAngleY;
    if (this->gyroZangle < -180 || this->gyroZangle > 180)
      this->gyroZangle = this->kalAngleY;

    // double adjustedMagX = this->magX * cos(this->kalAngleX) + this->magZ * sin(this->kalAngleY);
    // double adjustedMagY = (this->magX * sin(this->kalAngleX) * sin(this->kalAngleY)) + 
    //                       (this->magY * cos(this->kalAngleX)) - 
    //                       (this->magZ * sin(this->kalAngleX) * cos(this->kalAngleY));

    // double yaw = atan2(adjustedMagY, adjustedMagX) * RAD_TO_DEG;
    // this->kalAngleZ = yaw;
  }

};

IMU imu1(5, 0x69);
IMU imu2(0, 0x69);
IMU imu3(1, 0x69);
IMU imu4(2, 0x69);
IMU imu5(3, 0x69);

IMU imus[] = {imu1, imu2, imu3, imu4, imu5};
int n_imus = 1;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  #if ARDUINO >= 157
    Wire.setClock(400000UL); // Set I2C frequency to 400kHz
  #else
    TWBR = ((F_CPU / 400000UL) - 16) / 2; // Set I2C frequency to 400kHz
  #endif

  for (int i=0; i < n_imus; i++) {
    Serial.print("Initializing IMU number ");
    Serial.println(i);
    imus[i].init();
  }
}

void loop() {  

  for (int i=0; i < n_imus; i++) {
    imus[i].update_angle();
    Serial.print(imus[i].kalAngleX);
    Serial.print('\t');
    Serial.print(imus[i].kalAngleY);
    Serial.print('\t');
  }

  Serial.println();
  delay(2);
}