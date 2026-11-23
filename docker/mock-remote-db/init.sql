-- Mock Remote FieldMA Databases for Local Development & Schema-Drift Testing
-- Hosts 3 independent schemas:
--   1. fieldma_alpha  : Full modern FieldMA schema
--   2. fieldma_beta   : Full modern FieldMA schema (higher volume)
--   3. fieldma_legacy : Older clone missing `device_logs` and `site_registration_v2_s`

CREATE DATABASE IF NOT EXISTS fieldma_alpha CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS fieldma_beta CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS fieldma_legacy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'fieldma_ro'@'%' IDENTIFIED BY 'readonly_secret';
GRANT SELECT ON fieldma_alpha.* TO 'fieldma_ro'@'%';
GRANT SELECT ON fieldma_beta.* TO 'fieldma_ro'@'%';
GRANT SELECT ON fieldma_legacy.* TO 'fieldma_ro'@'%';
FLUSH PRIVILEGES;

-- ============================================================
-- 1. fieldma_alpha (Full Modern Schema)
-- ============================================================
USE fieldma_alpha;

CREATE TABLE mobileusers (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), fcm_id VARCHAR(255) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE device_logs (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE attendance_statuses (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, mobileuser_id BIGINT UNSIGNED NOT NULL, status VARCHAR(32) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE orders (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, total DECIMAL(12,2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE visits (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, status VARCHAR(32) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE payments (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, amount DECIMAL(12,2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE tada_entries (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, deleted_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE tada_dealer_expenses (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, amount DECIMAL(10,2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE tada_other_expenses (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, amount DECIMAL(10,2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE locations (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE messages (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, `from` BIGINT UNSIGNED NOT NULL, body TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE schedulevisits (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE site_registration_v2_s (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, site_name VARCHAR(120), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE notices (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, title VARCHAR(150), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

INSERT INTO mobileusers (name, fcm_id) VALUES ('Rep 1', 'fcm_a1'), ('Rep 2', 'fcm_a2'), ('Rep 3', NULL), ('Rep 4', 'fcm_a4');
INSERT INTO device_logs (user_id) VALUES (1), (2), (2), (4);
INSERT INTO attendance_statuses (mobileuser_id, status) VALUES (1, 'checkin'), (2, 'checkin'), (1, 'checkout');
INSERT INTO orders (total) VALUES (1200.00), (4500.50), (890.00);
INSERT INTO visits (status) VALUES ('online'), ('Online'), ('offline'), ('unlisted');
INSERT INTO payments (amount) VALUES (2000.00), (1500.00);
INSERT INTO tada_entries (deleted_at) VALUES (NULL), (NULL), (NOW());
INSERT INTO tada_dealer_expenses (amount) VALUES (350.00), (420.00);
INSERT INTO tada_other_expenses (amount) VALUES (150.00);
INSERT INTO locations (user_id) VALUES (1), (1), (2);
INSERT INTO messages (`from`, body) VALUES (1, 'Order dispatched'), (2, 'Check-in ok'), (1, 'Followup');
INSERT INTO schedulevisits (user_id) VALUES (1), (2), (4);
INSERT INTO site_registration_v2_s (site_name) VALUES ('Pokhara Depot'), ('Chitwan Hub');
INSERT INTO notices (title) VALUES ('Monthly Target Update');

-- ============================================================
-- 2. fieldma_beta (Full Modern Schema — Higher Activity)
-- ============================================================
USE fieldma_beta;

CREATE TABLE mobileusers LIKE fieldma_alpha.mobileusers;
CREATE TABLE device_logs LIKE fieldma_alpha.device_logs;
CREATE TABLE attendance_statuses LIKE fieldma_alpha.attendance_statuses;
CREATE TABLE orders LIKE fieldma_alpha.orders;
CREATE TABLE visits LIKE fieldma_alpha.visits;
CREATE TABLE payments LIKE fieldma_alpha.payments;
CREATE TABLE tada_entries LIKE fieldma_alpha.tada_entries;
CREATE TABLE tada_dealer_expenses LIKE fieldma_alpha.tada_dealer_expenses;
CREATE TABLE tada_other_expenses LIKE fieldma_alpha.tada_other_expenses;
CREATE TABLE locations LIKE fieldma_alpha.locations;
CREATE TABLE messages LIKE fieldma_alpha.messages;
CREATE TABLE schedulevisits LIKE fieldma_alpha.schedulevisits;
CREATE TABLE site_registration_v2_s LIKE fieldma_alpha.site_registration_v2_s;
CREATE TABLE notices LIKE fieldma_alpha.notices;

INSERT INTO mobileusers (name, fcm_id) VALUES ('B1','fb1'),('B2','fb2'),('B3','fb3'),('B4','fb4'),('B5','fb5'),('B6',NULL);
INSERT INTO device_logs (user_id) VALUES (1),(2),(3),(4),(5);
INSERT INTO attendance_statuses (mobileuser_id, status) VALUES (1,'checkin'),(2,'checkin'),(3,'checkin'),(4,'checkin'),(1,'checkout'),(2,'checkout');
INSERT INTO orders (total) VALUES (500),(600),(700),(800),(900),(1000);
INSERT INTO visits (status) VALUES ('online'),('online'),('online'),('offline'),('offline'),('unlisted');
INSERT INTO payments (amount) VALUES (1000),(2000),(3000),(4000);
INSERT INTO tada_entries (deleted_at) VALUES (NULL),(NULL),(NULL);
INSERT INTO tada_dealer_expenses (amount) VALUES (100),(200),(300);
INSERT INTO tada_other_expenses (amount) VALUES (50),(75);
INSERT INTO locations (user_id) VALUES (1),(2),(3),(4),(5);
INSERT INTO messages (`from`, body) VALUES (1,'Hi'),(2,'Hi'),(3,'Hi'),(4,'Hi');
INSERT INTO schedulevisits (user_id) VALUES (1),(2),(3),(4),(5);
INSERT INTO site_registration_v2_s (site_name) VALUES ('Biratnagar'), ('Butwal'), ('Birgunj');
INSERT INTO notices (title) VALUES ('Holiday Notice'), ('Price List v2');

-- ============================================================
-- 3. fieldma_legacy (Older Clone — Missing device_logs & site_registration_v2_s)
-- ============================================================
USE fieldma_legacy;

CREATE TABLE mobileusers LIKE fieldma_alpha.mobileusers;
CREATE TABLE attendance_statuses LIKE fieldma_alpha.attendance_statuses;
CREATE TABLE orders LIKE fieldma_alpha.orders;
CREATE TABLE visits LIKE fieldma_alpha.visits;
CREATE TABLE payments LIKE fieldma_alpha.payments;
CREATE TABLE tada_entries LIKE fieldma_alpha.tada_entries;
CREATE TABLE tada_dealer_expenses LIKE fieldma_alpha.tada_dealer_expenses;
CREATE TABLE locations LIKE fieldma_alpha.locations;
CREATE TABLE messages LIKE fieldma_alpha.messages;
CREATE TABLE schedulevisits LIKE fieldma_alpha.schedulevisits;
CREATE TABLE notices LIKE fieldma_alpha.notices;

INSERT INTO mobileusers (name, fcm_id) VALUES ('L1','fl1'),('L2','fl2'),('L3',NULL);
INSERT INTO attendance_statuses (mobileuser_id, status) VALUES (1,'checkin'),(2,'checkin');
INSERT INTO orders (total) VALUES (300);
INSERT INTO visits (status) VALUES ('online'),('offline');
INSERT INTO payments (amount) VALUES (500);
INSERT INTO tada_entries (deleted_at) VALUES (NULL);
INSERT INTO tada_dealer_expenses (amount) VALUES (200);
INSERT INTO locations (user_id) VALUES (1);
INSERT INTO messages (`from`, body) VALUES (1,'Legacy ping');
INSERT INTO schedulevisits (user_id) VALUES (1),(2);
INSERT INTO notices (title) VALUES ('Legacy Notice');
