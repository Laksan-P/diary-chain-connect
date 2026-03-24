-- ============================================================
-- Nestlé Dairy Supply Chain — PostgreSQL Schema
-- ============================================================

-- Create Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('farmer', 'chilling_center', 'nestle');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE milk_type AS ENUM ('Buffalo', 'Cow', 'Goat');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE quality_result AS ENUM ('Pass', 'Fail');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dispatch_status AS ENUM ('Pending', 'Dispatched', 'Approved', 'Rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('quality_result', 'payment', 'dispatch', 'general');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('Pending', 'Paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -------- USERS --------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          user_role NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------- CHILLING CENTERS --------
CREATE TABLE IF NOT EXISTS chilling_centers (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  location    VARCHAR(255) NOT NULL,
  user_id     INT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- -------- NESTLE OFFICERS --------
CREATE TABLE IF NOT EXISTS nestle_officers (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  designation VARCHAR(255) DEFAULT 'Officer',
  user_id     INT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- -------- FARMERS --------
CREATE TABLE IF NOT EXISTS farmers (
  id                  SERIAL PRIMARY KEY,
  farmer_id           VARCHAR(20) NOT NULL UNIQUE,
  user_id             INT NOT NULL,
  name                VARCHAR(255) NOT NULL,
  address             VARCHAR(500),
  phone               VARCHAR(20) UNIQUE,
  nic                 VARCHAR(20) UNIQUE,
  chilling_center_id  INT NOT NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (chilling_center_id) REFERENCES chilling_centers(id) ON DELETE CASCADE
);

-- -------- BANK ACCOUNTS --------
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              SERIAL PRIMARY KEY,
  farmer_id       INT NOT NULL,
  bank_name       VARCHAR(255),
  account_number  VARCHAR(100),
  branch          VARCHAR(255),
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
);

-- -------- CHILLING CENTER ACCOUNTS --------
CREATE TABLE IF NOT EXISTS chilling_center_accounts (
  id                  SERIAL PRIMARY KEY,
  chilling_center_id  INT NOT NULL,
  bank_name           VARCHAR(255),
  account_number      VARCHAR(100),
  branch              VARCHAR(255),
  FOREIGN KEY (chilling_center_id) REFERENCES chilling_centers(id) ON DELETE CASCADE
);

-- -------- NESTLE OFFICER ACCOUNTS --------
CREATE TABLE IF NOT EXISTS nestle_officer_accounts (
  id              SERIAL PRIMARY KEY,
  nestle_officer_id INT NOT NULL,
  bank_name       VARCHAR(255),
  account_number  VARCHAR(100),
  branch          VARCHAR(255),
  FOREIGN KEY (nestle_officer_id) REFERENCES nestle_officers(id) ON DELETE CASCADE
);

-- -------- MILK COLLECTIONS --------
CREATE TABLE IF NOT EXISTS milk_collections (
  id                  SERIAL PRIMARY KEY,
  farmer_id           INT NOT NULL,
  chilling_center_id  INT NOT NULL,
  date                DATE NOT NULL,
  time                TIME NOT NULL,
  temperature         DECIMAL(5,2) NOT NULL,
  quantity            DECIMAL(10,2) NOT NULL,
  milk_type           milk_type DEFAULT 'Cow',
  quality_result      quality_result DEFAULT NULL,
  failure_reason      VARCHAR(255) DEFAULT NULL,
  dispatch_status     dispatch_status DEFAULT 'Pending',
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (chilling_center_id) REFERENCES chilling_centers(id) ON DELETE CASCADE
);

-- -------- QUALITY TESTS --------
CREATE TABLE IF NOT EXISTS quality_tests (
  id              SERIAL PRIMARY KEY,
  collection_id   INT NOT NULL,
  fat             DECIMAL(5,2) NOT NULL,
  snf             DECIMAL(5,2) NOT NULL,
  water           DECIMAL(5,2) NOT NULL,
  result          quality_result NOT NULL,
  reason          VARCHAR(255) DEFAULT NULL,
  tested_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES milk_collections(id) ON DELETE CASCADE
);

-- -------- DISPATCHES --------
CREATE TABLE IF NOT EXISTS dispatches (
  id                  SERIAL PRIMARY KEY,
  chilling_center_id  INT NOT NULL,
  transporter_name    VARCHAR(255) NOT NULL,
  vehicle_number      VARCHAR(50) NOT NULL,
  driver_contact      VARCHAR(20) NOT NULL,
  dispatch_date       DATE NOT NULL,
  status              dispatch_status DEFAULT 'Dispatched',
  rejection_reason    VARCHAR(500) DEFAULT NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chilling_center_id) REFERENCES chilling_centers(id) ON DELETE CASCADE
);

-- -------- DISPATCH ITEMS --------
CREATE TABLE IF NOT EXISTS dispatch_items (
  id              SERIAL PRIMARY KEY,
  dispatch_id     INT NOT NULL,
  collection_id   INT NOT NULL,
  FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES milk_collections(id) ON DELETE CASCADE
);

-- -------- PRICING RULES --------
CREATE TABLE IF NOT EXISTS pricing_rules (
  id                  SERIAL PRIMARY KEY,
  base_price_per_liter DECIMAL(10,2) NOT NULL,
  fat_bonus           DECIMAL(10,2) NOT NULL,
  snf_bonus           DECIMAL(10,2) NOT NULL,
  effective_from       DATE NOT NULL,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------- PAYMENTS --------
CREATE TABLE IF NOT EXISTS payments (
  id              SERIAL PRIMARY KEY,
  farmer_id       INT NOT NULL,
  collection_id   INT NOT NULL,
  quantity        DECIMAL(10,2) NOT NULL,
  base_pay        DECIMAL(10,2) NOT NULL,
  fat_bonus       DECIMAL(10,2) DEFAULT 0,
  snf_bonus       DECIMAL(10,2) DEFAULT 0,
  amount          DECIMAL(10,2) NOT NULL,
  status          payment_status DEFAULT 'Pending',
  paid_at         TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES milk_collections(id) ON DELETE CASCADE
);

-- -------- NOTIFICATIONS --------
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL,
  type        notification_type DEFAULT 'general',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
