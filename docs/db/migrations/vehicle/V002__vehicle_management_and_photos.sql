-- MANUAL ONLY: run only after explicit approval, a verified backup and confirmation
-- that the selected schema belongs to Vehicle Service. This file is not auto-loaded.
-- MySQL 8 DDL commits implicitly. Apply once; do not blindly rerun after a partial failure.
-- Existing vehicle rows, identifiers, lifecycle states and references are preserved.

ALTER TABLE vehicles
    ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN transmission VARCHAR(40) NULL,
    ADD COLUMN engine_power_hp INT NULL,
    ADD COLUMN color VARCHAR(80) NULL,
    ADD COLUMN description VARCHAR(6000) NULL;

CREATE TABLE vehicle_photos (
    id BIGINT NOT NULL AUTO_INCREMENT,
    vehicle_id BIGINT NOT NULL,
    filename VARCHAR(64) NOT NULL,
    thumbnail_filename VARCHAR(64) NOT NULL,
    position INT NOT NULL,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT uk_vehicle_photos_filename UNIQUE (filename),
    CONSTRAINT uk_vehicle_photos_thumbnail UNIQUE (thumbnail_filename),
    INDEX idx_vehicle_photos_vehicle_position (vehicle_id, position, id),
    CONSTRAINT fk_vehicle_photos_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
) ENGINE=InnoDB;
