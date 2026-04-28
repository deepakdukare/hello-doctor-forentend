# Software Requirements Specification (SRS)
## Project: Dr. Indu Child Care Frontend

### 1. Introduction
#### 1.1 Purpose
This document provides a comprehensive overview of the software requirements for the **Dr. Indu Child Care Frontend** application. It serves as a guide for developers, project managers, and stakeholders to understand the system's functionality and constraints.

#### 1.2 Scope
The Dr. Indu Child Care Frontend is a web-based management system designed for "Dr. Indu's New Born & Childcare Center". It allows the clinic staff, doctors, and administrators to manage patient registrations, appointments, medical records, and clinic operations efficiently. The system also includes a public landing page for patient registration and feedback.

#### 1.3 Definitions and Abbreviations
- **SRS**: Software Requirements Specification
- **MRD**: Medical Records Department
- **Super Admin**: Highest level of access, manages system-wide settings and administrative users.
- **Admin**: Staff member with administrative privileges for managing clinic operations.
- **Doctor**: Physician providing medical services, with access to patient and appointment data.
- **n8n**: Workflow automation tool used for bot interactions and webhooks.

---

### 2. Overall Description
#### 2.1 Product Perspective
The system is built using modern web technologies (**React + Vite**) and communicates with a backend API via REST. It is designed to be responsive, working on both desktop and mobile devices.

#### 2.2 User Classes and Characteristics
- **Super Admin**: Manages the entire platform, including clinic settings, administrative accounts, and system-wide analytics.
- **Admin/Staff**: Handles daily operations, patient registration, and appointment scheduling.
- **Doctor**: Views their own appointments, manages patient medical records, and monitors their performance analytics.
- **Patients (External)**: Use the public registration form and feedback hub.

#### 2.3 Operating Environment
- **Browser**: Modern web browsers (Chrome, Firefox, Safari, Edge).
- **Hosting**: Vercel (or similar cloud platforms).
- **Resolution**: Optimized for both high-resolution desktops and mobile screens.

---

### 3. System Features (Functional Requirements)

#### 3.1 Authentication & Authorization
- Secure login for staff and doctors.
- Role-based access control (RBAC) ensuring users only see what their permissions allow (e.g., Doctors cannot see Super Admin settings).
- Session management using JWT (JSON Web Tokens).

#### 3.2 Dashboard Hub
- Visual representation of clinic statistics (Total Patients, Appointments, Today's Revenue, etc.).
- Real-time summaries of clinic activity.

#### 3.3 Appointment Management
- Create, update, and cancel appointments.
- Filter appointments by doctor, status, and date.
- Seamless integration with the queue system.

#### 3.4 Queue & Token System
- Generate queue tokens for walk-in and scheduled patients.
- Real-time "Queue Display" for clinic waiting areas.

#### 3.5 Patient Management
- Comprehensive patient database with search functionality.
- Detailed patient profiles including contact info, medical history, and past visits.

#### 3.6 Medical Records Department (MRD)
- Upload and manage patient reports and prescriptions.
- Secure access to digital medical records.

#### 3.7 Public Forms
- **Public Registration**: Allows new patients to register their details via a standalone link.
- **Feedback Hub**: Captures patient satisfaction and feedback post-visit.

#### 3.8 Bot & Webhook Integration
- Integration with n8n for automated bot interactions.
- Manage bot status and review logs.

#### 3.9 Notifications
- Real-time alerts for new registrations or appointment updates.
- Centralized notification center for staff.

---

### 4. External Interface Requirements
#### 4.1 User Interface
- Clean, modern, and responsive UI built with **Vanilla CSS** and **Lucide React** icons.
- Glassmorphism and premium design aesthetics.
- Optimized "Clinic Display" mode for large screens.

#### 4.2 Software Interfaces
- **API**: Communicates with the backend at `https://api-vfbnzo4maa-uc.a.run.app`.
- **Vite**: Frontend build tool and development server.
- **React Router**: For client-side navigation.

---

### 5. Non-functional Requirements
#### 5.1 Performance
- Fast initial load using Code Splitting (Suspense/Lazy loading).
- Responsive search and filtering for large datasets.

#### 5.2 Security
- Permissions check on every route and component.
- Protection against unauthorized API calls via JWT injection in headers.
- Redaction of sensitive patient contact information for non-authorized roles (e.g., Doctors may not see mobile numbers depending on policy).

#### 5.3 Availability
- 24/7 access for both the admin dashboard and public-facing forms.

---

### 6. Project Roadmap
- [x] Core Authentication
- [x] Appointment & Queue System
- [x] Patient & MRD Management
- [x] Public Registration & Feedback
- [x] Role-Based Permissions
- [ ] Advanced Reporting & Analytics Enhancements
- [ ] Real-time Chat/Bot integration Improvements
