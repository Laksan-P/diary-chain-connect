-- ============================================================
-- Nestlé Dairy Supply Chain — MySQL Schema
-- ============================================================

DROP DATABASE IF EXISTS nestle_dairy_supply_chain;
CREATE DATABASE nestle_dairy_supply_chain;
USE nestle_dairy_supply_chain;

-- -------- USERS --------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          ENUM('farmer', 'chilling_center', 'nestle') NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------- CHILLING CENTERS --------
CREATE TABLE IF NOT EXISTS chilling_centers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  location    VARCHAR(255) NOT NULL,
  user_id     INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- -------- NESTLE OFFICERS --------
CREATE TABLE IF NOT EXISTS nestle_officers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  designation VARCHAR(255) DEFAULT 'Officer',
  user_id     INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- -------- FARMERS --------
CREATE TABLE IF NOT EXISTS farmers (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id           VARCHAR(20) NOT NULL UNIQUE,
  user_id             INT NOT NULL,
  name                VARCHAR(255) NOT NULL,
  address             VARCHAR(500),
  phone               VARCHAR(20),
  nic                 VARCHAR(20),
  chilling_center_id  INT NOT NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (chilling_center_id) REFERENCES chilling_centers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------- BANK ACCOUNTS --------
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id       INT NOT NULL,
  bank_name       VARCHAR(255),
  account_number  VARCHAR(100),
  branch          VARCHAR(255),
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------- CHILLING CENTER ACCOUNTS --------
CREATE TABLE IF NOT EXISTS chilling_center_accounts (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  chilling_center_id  INT NOT NULL,
  bank_name           VARCHAR(255),
  account_number      VARCHAR(100),
  branch              VARCHAR(255),
  FOREIGN KEY (chilling_center_id) REFERENCES chilling_centers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------- NESTLE OFFICER ACCOUNTS --------
CREATE TABLE IF NOT EXISTS nestle_officer_accounts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nestle_officer_id INT NOT NULL,
  bank_name       VARCHAR(255),
  account_number  VARCHAR(100),
  branch          VARCHAR(255),
  FOREIGN KEY (nestle_officer_id) REFERENCES nestle_officers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------- MILK COLLECTIONS --------
CREATE TABLE IF NOT EXISTS milk_collections (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id           INT NOT NULL,
  chilling_center_id  INT NOT NULL,
  date                DATE NOT NULL,
  time                TIME NOT NULL,
  temperature         DECIMAL(5,2) NOT NULL,
  quantity            DECIMAL(10,2) NOT NULL,
  milk_type           ENUM('Buffalo', 'Cow', 'Goat') DEFAULT 'Cow',
  quality_result      ENUM('Pass', 'Fail') DEFAULT NULL,
  failure_reason      VARCHAR(255) DEFAULT NULL,
  dispatch_status     ENUM('Pending', 'Dispatched', 'Approved', 'Rejected') DEFAULT 'Pending',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (chilling_center_id) REFERENCES chilling_centers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------- QUALITY TESTS --------
CREATE TABLE IF NOT EXISTS quality_tests (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  collection_id   INT NOT NULL,
  fat             DECIMAL(5,2) NOT NULL,
  snf             DECIMAL(5,2) NOT NULL,
  water           DECIMAL(5,2) NOT NULL,
  result          ENUM('Pass', 'Fail') NOT NULL,
  reason          VARCHAR(255) DEFAULT NULL,
  tested_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES milk_collections(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------- DISPATCHES --------
CREATE TABLE IF NOT EXISTS dispatches (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  chilling_center_id  INT NOT NULL,
  transporter_name    VARCHAR(255) NOT NULL,
  vehicle_number      VARCHAR(50) NOT NULL,
  driver_contact      VARCHAR(20) NOT NULL,
  dispatch_date       DATE NOT NULL,
  status              ENUM('Dispatched', 'Approved', 'Rejected') DEFAULT 'Dispatched',
  rejection_reason    VARCHAR(500) DEFAULT NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chilling_center_id) REFERENCES chilling_centers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------- DISPATCH ITEMS --------
CREATE TABLE IF NOT EXISTS dispatch_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  dispatch_id     INT NOT NULL,
  collection_id   INT NOT NULL,
  FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES milk_collections(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------- PRICING RULES --------
CREATE TABLE IF NOT EXISTS pricing_rules (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  base_price_per_liter DECIMAL(10,2) NOT NULL,
  fat_bonus           DECIMAL(10,2) NOT NULL,
  snf_bonus           DECIMAL(10,2) NOT NULL,
  effective_from      DATE NOT NULL,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------- PAYMENTS --------
CREATE TABLE IF NOT EXISTS payments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id       INT NOT NULL,
  collection_id   INT NOT NULL,
  quantity        DECIMAL(10,2) NOT NULL,
  base_pay        DECIMAL(10,2) NOT NULL,
  fat_bonus       DECIMAL(10,2) DEFAULT 0,
  snf_bonus       DECIMAL(10,2) DEFAULT 0,
  amount          DECIMAL(10,2) NOT NULL,
  status          ENUM('Pending', 'Paid') DEFAULT 'Pending',
  paid_at         TIMESTAMP NULL DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES milk_collections(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------- NOTIFICATIONS --------
CREATE TABLE IF NOT EXISTS notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL,
  type        ENUM('quality_result', 'payment', 'dispatch', 'general') DEFAULT 'general',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
