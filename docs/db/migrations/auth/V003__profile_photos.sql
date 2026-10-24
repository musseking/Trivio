-- Apply once to users_db, after V002. Existing accounts are preserved.
ALTER TABLE users ADD COLUMN profile_photo_version VARCHAR(36) NULL;

CREATE TABLE user_profile_photos (
    user_id BIGINT NOT NULL,
    image MEDIUMBLOB NOT NULL,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_profile_photo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
