# Motion-Mend-SeniorDesign

MotionMend is an integrated product that combines a Hardware and Software approach to improve patient outcomes after total knee replacement surgery. 


MotionMend, a complete hardware and software ecosystem that works seamlessly to provide a smooth patient experience. Our patient will wear two PCB modules that we have designed that incorporate inertial mea- surement units (IMUs) to calculate the angle around their knee joint. The data is then processed through a Kalman Filter which is communicated over Bluetooth Low Energy to the mobile app. The mobile app will do an angle calculation based on the IMU’s data and display the angle to the patient. In addition, there is an angle visualization that is provided in the app. The app will tell the patient what their target angle is and visualize the difference. After the exercise is complete, the angle measurements and time of the exercise are transmitted to our cloud which is hosted on Amazon Web Services (AWS). The data is stored securely in AWS and is then hosted on a dashboard to provide an overview of patient data to the medical provider. 

This project was done in collaboration with Kenzo Sakamoto, Leon Kabue, Adam Gorka, and Hassan Rizwan. 

![Case_PCB](https://github.com/user-attachments/assets/0f88a0db-be44-43dc-a1c0-72f77b17dd36)

<img width="433" height="925" alt="App" src="https://github.com/user-attachments/assets/6408ed8a-5deb-4343-9db0-e4b4b5550c87" />

![Workflow 2](https://github.com/user-attachments/assets/e958ffa7-04ac-427a-8e80-91cf200db036)
