#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ICM20X.h>
#include <Adafruit_ICM20948.h>
#define MAG_DATARATE_A AK09916_MAG_DATARATE_10_HZ
#define MAG_DATARATE_B AK09916_MAG_DATARATE_100_HZ
#define MEASUREMENTS_PER_RATE 500
#define I2C_ADDR 0x68

// LSM303 compass;
Adafruit_ICM20948 *icm;
Adafruit_Sensor *icm_temp, *icm_accel, *icm_gyro, *icm_mag;

double accX, accY, accZ;
double gyroX, gyroY, gyroZ;
double magX, magY, magZ;
int16_t tempRaw;

const float alpha = 0.15;
float fXa = 0;
float fYa = 0;
float fZa = 0;
float fXm = 0;
float fYm = 0;
float fZm = 0;

void setup_icm() {
    Serial.begin(115200);
    while (!Serial)
        delay(10); // will pause Zero, Leonardo, etc until serial console opens
    if (!icm->begin_I2C(I2C_ADDR)) {
        Serial.println("Failed to find ICM20948 chip");
        while (1) {
            delay(10);
        }
    }
    // Get an Adafruit_Sensor compatible object for the ICM20948's magnetometer    
    icm->enableAccelDLPF(true, ICM20X_ACCEL_FREQ_5_7_HZ);
    icm->setMagDataRate(MAG_DATARATE_B);
    icm_temp = icm->getTemperatureSensor();
    icm_accel = icm->getAccelerometerSensor();
    icm_gyro = icm->getGyroSensor();
    icm_mag = icm->getMagnetometerSensor();
}

void refresh_values() {
    sensors_event_t accel;
    sensors_event_t gyro;
    sensors_event_t temp;
    sensors_event_t mag;
    delay(2);
    icm_temp->getEvent(&temp);
    icm_accel->getEvent(&accel);
    icm_gyro->getEvent(&gyro);
    icm_mag->getEvent(&mag);

    tempRaw = temp.temperature;

    accX = accel.acceleration.x;
    accY = accel.acceleration.y;
    accZ = accel.acceleration.z;

    gyroX = gyro.gyro.x;
    gyroY = gyro.gyro.y;
    gyroZ = gyro.gyro.z;

    magX = mag.magnetic.x;
    magY = mag.magnetic.y;
    magZ = mag.magnetic.z;
}

void setup() {
    setup_icm();
}

void loop()
{
refresh_values();
float pitch, pitch_print, roll, roll_print, Heading, Xa_off, Ya_off, Za_off, Xa_cal, Ya_cal, Za_cal, Xm_off, Ym_off, Zm_off, Xm_cal, Ym_cal, Zm_cal, fXm_comp, fYm_comp;

// Accelerometer calibration
Xa_off = accX/16.0 + 6.008747;
Ya_off = accY/16.0 - 18.648762;
Za_off = accZ/16.0 + 10.808316;
Xa_cal =  0.980977*Xa_off + 0.001993*Ya_off - 0.004377*Za_off;
Ya_cal =  0.001993*Xa_off + 0.998259*Ya_off - 0.000417*Za_off;
Za_cal = -0.004377*Xa_off - 0.000417*Ya_off + 0.942771*Za_off;

// Magnetometer calibration
Xm_off = magX*(100000.0/1100.0) - 8397.862881;
Ym_off = magY*(100000.0/1100.0) - 3307.507492;
Zm_off = magZ*(100000.0/980.0 ) + 2718.831179;
Xm_cal =  0.949393*Xm_off + 0.006185*Ym_off + 0.015063*Zm_off;
Ym_cal =  0.006185*Xm_off + 0.950124*Ym_off + 0.003084*Zm_off;
Zm_cal =  0.015063*Xm_off + 0.003084*Ym_off + 0.880435*Zm_off;

// Low-Pass filter accelerometer
fXa = Xa_cal * alpha + (fXa * (1.0 - alpha));
fYa = Ya_cal * alpha + (fYa * (1.0 - alpha));
fZa = Za_cal * alpha + (fZa * (1.0 - alpha));

// Low-Pass filter magnetometer
fXm = Xm_cal * alpha + (fXm * (1.0 - alpha));
fYm = Ym_cal * alpha + (fYm * (1.0 - alpha));
fZm = Zm_cal * alpha + (fZm * (1.0 - alpha));

// Pitch and roll
roll  = atan2(fYa, sqrt(fXa*fXa + fZa*fZa));
pitch = atan2(fXa, sqrt(fYa*fYa + fZa*fZa));
roll_print = roll*180.0/M_PI;
pitch_print = pitch*180.0/M_PI;

// Tilt compensated magnetic sensor measurements
fXm_comp = fXm*cos(pitch)+fZm*sin(pitch);
fYm_comp = fXm*sin(roll)*sin(pitch)+fYm*cos(roll)-fZm*sin(roll)*cos(pitch);

// Arctangent of y/x
Heading = (atan2(fYm_comp,fXm_comp)*180.0)/M_PI;
if (Heading < 0)
Heading += 360;

Serial.print("Pitch (X): "); Serial.print(pitch_print); Serial.print("  ");
Serial.print("Roll (Y): "); Serial.print(roll_print); Serial.print("  ");
Serial.print("Heading: "); Serial.println(Heading);
delay(250);
}