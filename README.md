# Dairy Chain Connect System

## Overview
Dairy Chain Connect is a comprehensive, full-stack dairy supply chain management platform designed to streamline and digitize operations between local farmers, regional chilling centers, and Nestlé processing facilities. 

The system aims to bring transparency, efficiency, and intelligence to the milk collection process, ensuring quality tracking, logistics management, and fair financial compensation.

The ecosystem consists of:
* **Web Dashboard** (for Nestlé Corporate & Regional Chilling Centers)
* **Mobile Application** (for Farmers – Android App)
* **Cloud Backend** (Vercel Serverless API)
* **Database** (Supabase PostgreSQL)

---

## How It Works: Development Sprints & Features

The platform was iteratively developed across three major sprints, each adding significant capabilities to the supply chain workflow.

### Sprint 1: Foundation & Core Collection Operations
The first sprint focused on establishing the core digital infrastructure and enabling the daily milk collection process.

* **Farmer Onboarding & Management:** Farmers can register via the mobile app or be onboarded by chilling center staff. They can manage their profiles, including vital bank details required for transparent digital payments.
* **Milk Collection & Quality Control:** Chilling centers use their dashboard to log daily milk deposits from farmers. Crucially, the system tracks quality testing metrics (such as Fat and SNF content) for every batch, which dictates the payment rate.
* **Centralized Dashboarding:** Nestlé officers and chilling center managers gain access to centralized dashboards to monitor collection histories and aggregated volumes in real-time.

### Sprint 2: Logistics, Dispatch & Financials
The second sprint bridged the gap between regional chilling centers and Nestlé facilities, while automating the financial compensation cycle.

* **Dispatch Management:** Chilling centers can initiate dispatch records when sending consolidated milk batches to Nestlé. This includes logging transporter details, vehicle numbers, and driver contact info.
* **Status Tracking:** The system monitors the lifecycle of a dispatch through various states (Pending, Dispatched, Approved, Rejected), ensuring full visibility of goods in transit.
* **Automated Payments:** Using the volume and quality data collected in Sprint 1, the system automatically calculates fair compensation for farmers, reducing manual errors and ensuring timely payouts.

### Sprint 3: Advanced Capabilities & AI Intelligence
The final sprint focused on user experience, system resilience, and predictive analytics.

* **Offline Functionality (Farmer App):** Recognizing that rural farmers often face poor network connectivity, the app now supports an Offline Mode. Critical data is cached locally, allowing farmers to access information and queue actions that automatically sync once the connection is restored.
* **Interactive FAQ & Support:** A comprehensive help center and ticketing system were integrated, empowering users to find answers to common questions quickly and request assistance when needed.
* **Performance Tracking:** Dashboards were upgraded with advanced analytics, allowing stakeholders to track operational efficiency, farmer yield trends, and facility performance over time.
* **Smart Demand & Supply Predictions:** Utilizing historical data, the system implements predictive algorithms (including Weighted Moving Averages and momentum trends) to forecast future milk supply and demand. This AI-driven insight helps Nestlé and chilling centers optimize resource planning, minimize wastage, and prepare for seasonal fluctuations.

---

## System Architecture

The application follows a modern, decoupled serverless architecture:

* **Frontend:** 
  * Web Dashboards: React (Vite) with Tailwind CSS.
  * Mobile App: Flutter.
* **Backend:** Node.js Serverless Functions hosted on Vercel.
* **Database:** Supabase (PostgreSQL) handling relational data, storage, and real-time subscriptions.
* **Authentication:** Secure JWT-based authentication flow.

---

## Application Access

### Web Application (Dashboard)
🔗 **Live URL:** https://diary-chain-connect.vercel.app/

### Mobile Application (Farmer App)
* **APK Download Link 1:** https://bit.ly/3R0RYtZ
* **APK Download Link 2:** https://appurl.io/ejbJD2qH3N
* **Backup Link:** https://drive.google.com/file/d/1zFHmxFcf1s0lkxBWYvUnt4PIkpHnCnrO/view?usp=sharing

**Installation Instructions:**
1. Download the APK file to your Android device.
2. Enable "Install Unknown Apps" in your device settings if prompted.
3. If prompted by Play Protect to scan the app, you may bypass the scan to proceed.
4. Install and open the application to begin registration.

---

## ✅ System Status
✔ Fully Functional  
✔ Deployed in Production Environment  
✔ Seamless Mobile & Web Integration
 