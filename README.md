# Pariksha - Online Examination Platform

Pariksha is a web-based platform designed to facilitate online examinations for educational institutions. It provides features for teachers to create and manage exams, add questions, and view student results. Students can log in, view available exams, and submit their answers.

## Features

**Teacher Dashboard:**

* View a summary of created exams and total questions.
* List all created exams with links to manage them.
* Display a list of recent activities performed by the teacher.
* Manage exams:
    * View a list of questions within an exam.
    * (Future: Edit and delete exams and questions).
* View a list of all registered students.

**Student Interface (Future Development):**

* Login securely.
* View a list of available exams.
* Take exams online.
* View submitted results.

**Admin Interface (Future Development):**

* Manage users (teachers and students).
* Configure system settings.
* View overall platform statistics.

## Technologies Used

* **Backend:** Node.js with Express.js
* **Database:** MongoDB
* **Templating Engine:** Pug
* **Frontend Styling:** CSS (with custom variables)
* **Icons:** Font Awesome

## Setup Instructions

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd Pariksha
    cd backend
    ```

2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

3.  **Configure MongoDB:**
    * Ensure you have MongoDB installed and running.
    * Update the MongoDB connection URI in your application's configuration file (e.g., `app.js` or a `.env` file). Look for a line similar to:
        ```javascript
        mongoose.connect('mongodb://localhost:27017/your_database_name', { useNewUrlParser: true, useUnifiedTopology: true });
        ```
        Replace `'mongodb://localhost:27017/your_database_name'` with your MongoDB connection string.

4.  **Run the application:**
    ```bash
    node app.js
    ```

    The server should start running on `http://localhost:3000` (or the port configured in your application).

## Accessing the Application

* **Teacher Dashboard:** Navigate to `/teacher/dashboard` in your web browser after logging in as a teacher.
* **Manage Exams:** Links to manage individual exams will be available on the teacher dashboard.
* **View Students:** Navigate to `/teacher/students` after logging in as a teacher.
* **Login:** The login page is likely located at `/login.html` (check your application's routes).

## Future Enhancements

* Implement student and admin interfaces.
* Add functionalities to create, edit, and delete exams and questions.
* Develop the online exam taking process for students.
* Implement result submission and viewing.
* Add user authentication and authorization.
* Implement more robust error handling and validation.
* Improve frontend styling and user experience.

## Contributing

Contributions to the Pariksha project are welcome. Please follow these steps:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and commit them.
4.  Push your changes to your fork.
5.  Submit a pull request.


## Contact

[Hritik Raj] (https://github.com/Hritikraj8804)