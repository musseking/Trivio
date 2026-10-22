# Trivio — Database Migration History

## Purpose

This document tracks the evolution of the database schemas used by the Trivio application.

Each microservice owns an independent MySQL database and maintains its own versioned migration history.

The purpose of this document is to provide transparency, traceability, and a reliable record of database schema changes throughout the project's development lifecycle.

## Initial State — October 19, 2026

The initial database schemas were reconstructed from the existing MySQL databases before applying Vehicle Service migration V002.

**Important:** The V001 files represent reconstructed baseline schemas. They are not the original migration scripts used to create the existing databases and must not be executed against those databases.

| Service | Migration | Description | Status |
|---|---|---|---|
| Auth | V001 | Initial `users` table schema | Reconstructed Baseline |
| Order | V001 | Initial `purchase_orders` table schema | Reconstructed Baseline |
| Payment | V001 | Initial `payment_attempts` table schema | Reconstructed Baseline |
| Vehicle | V001 | Initial `vehicles` table schema | Reconstructed Baseline |
| Vehicle | V002 | Vehicle management extensions and the `vehicle_photos` table | Applied — Source and Replica Verified |

## Migration Tracking Rules

The following rules apply to all database schema changes:

1. Every schema modification must be documented in a new, versioned SQL migration file.
2. Each microservice maintains its own independent migration version sequence.
3. Applied migration files must remain immutable. Corrections must be introduced through new migrations.
4. Each migration must record its execution date, outcome, and associated Git commit when available.
5. Migrations must be executed against the authoritative source database of the corresponding microservice.
6. The Windows MySQL replica receives schema changes through the configured replication channels.
7. Database backups and replication health must be verified before performing potentially destructive operations.
8. Existing business data, primary keys, foreign keys, and referential integrity must be preserved.
9. Failed migrations must be investigated before attempting recovery or re-execution.
10. Migration history must accurately reflect operations that were actually performed.

## Migration Execution History

### Vehicle Service — V002

**Migration File:** `vehicle/V002__vehicle_management_and_photos.sql`

**Status:** Applied — Source and Replica Verified

**Purpose:**

Extend the existing vehicle management functionality by introducing:

- Vehicle archiving support.
- Transmission information.
- Engine power specifications.
- Vehicle color.
- Detailed vehicle descriptions.
- A new `vehicle_photos` table for managing vehicle image metadata, display order, and cover photographs.

**Target Database:** `vehicle_db`

**Execution Date:** October 19, 2026

**Execution Result:**

Successfully applied to the Docker MySQL source database.

The migration added the following columns to the existing `vehicles` table:

- `archived`
- `transmission`
- `engine_power_hp`
- `color`
- `description`

The `vehicle_photos` table was successfully created.

All three existing vehicle records retained their original IDs and lifecycle statuses. The new `archived` field was initialized to `false` for all existing vehicles.

**Replication Verification:**

Successfully verified on the Windows MySQL replica using the `trivio_vehicle` replication channel.

Verification confirmed that:

- All five new vehicle columns were replicated.
- The `vehicle_photos` table was created on the replica.
- All three existing vehicle records were preserved.
- The replication I/O and SQL processes were running without reported errors.

**Application Verification:**

The updated Vehicle Service was successfully started using Java 25 and Spring Boot 4.1.0.

Hibernate initialized successfully against the migrated MySQL schema, and the Vehicle Service registered with Eureka.

The public vehicle catalog was successfully retrieved through the API Gateway, returning all three existing vehicles.

**Associated Git Commit:** Pending.

## Future Migration Records

Every subsequent migration must be documented in this file, including:

- Microservice and migration version.
- Migration file name.
- Description and purpose of the schema changes.
- Target database.
- Execution date.
- Execution status and verification results.
- Replication verification, where applicable.
- Application compatibility verification, where applicable.
- Associated Git commit.

Migration records must distinguish between prepared, successfully applied, and failed migrations.

The documentation must accurately represent the database changes that were actually executed and verified.