
-- Trivio Auth Service
-- V002: Single-owner enforcement and first-time ownership tracking.
--
-- Apply only after checking the existing users table.
-- Back up the database before executing this migration.
-- Do not execute this migration more than once.

-- Enforce at most one OWNER account.
-- NULL values allow multiple ADMIN and CUSTOMER accounts.
ALTER TABLE users
    ADD COLUMN owner_slot TINYINT
        GENERATED ALWAYS AS (
            CASE WHEN `role` = 'OWNER' THEN 1 ELSE NULL END
        ) STORED,
    ADD UNIQUE KEY uk_users_single_owner (owner_slot);

-- Persist the first-time setup state independently of user deletion.
CREATE TABLE owner_bootstrap (
    id TINYINT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    owner_user_id BIGINT NULL,
    completed_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_owner_bootstrap_singleton CHECK (id = 1)
) ENGINE=InnoDB;

-- Existing installations with an OWNER are already initialized.
-- New installations without an OWNER remain available for setup.
INSERT INTO owner_bootstrap (id, completed, owner_user_id)
SELECT
    1,
    EXISTS (SELECT 1 FROM users WHERE `role` = 'OWNER'),
    (SELECT id FROM users WHERE `role` = 'OWNER' LIMIT 1);
