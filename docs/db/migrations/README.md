# Trivio — Database Migrations

## Overview

Trivio is a microservice-based vehicle dealership application built with Java, Spring Boot, Spring Cloud, React and MySQL.

Each business microservice owns its database schema and maintains an independent migration history.

The purpose of this directory is to provide reproducible schema definitions, traceable database changes and clear documentation for development, maintenance and deployment.

## Database Architecture

| Microservice | Database | Local source port |
|---|---|---|
| Vehicle Service | `vehicle_db` | 3307 |
| Order Service | `order_db` | 3308 |
| Payment Service | `payment_db` | 3309 |
| Auth Service | `users_db` | 3310 |

All source databases run in Docker using MySQL 8.4.

A separate Windows MySQL instance receives changes through dedicated replication channels.

## Migration Structure

```text
migrations/
├── auth/
│   └── V001__baseline_schema.sql
├── order/
│   └── V001__baseline_schema.sql
├── payment/
│   └── V001__baseline_schema.sql
├── vehicle/
│   ├── V001__baseline_schema.sql
│   └── V002__vehicle_management_and_photos.sql
├── README.md
└── MIGRATION_HISTORY.md
```

Each microservice maintains its own version sequence.

## Baseline Policy

The V001 files are reconstructed snapshots of the existing schemas captured on October 19, 2026, before Vehicle V002 was applied.

They document the initial managed state of the databases.

These files were not used to originally create the existing databases and must not be executed against them.

They may serve as a reference when initializing new, empty database environments, subject to compatibility verification.

## Migration Rules

1. Every schema change requires a new, numbered SQL migration.
2. Version numbers increase independently for each microservice.
3. Applied migrations must remain immutable.
4. Corrections to previously applied migrations require a new migration file.
5. Production data, credentials and secrets must not be included in migration files.
6. Schema changes must preserve referential integrity and existing business data.
7. Each migration must be reviewed and tested before application.
8. The migration history must be updated with the execution date, outcome and relevant Git commit.

## Execution Policy

Migrations are currently executed manually.

Before executing a migration:

- Confirm the target service and source database.
- Verify that previous migrations are already represented in the schema.
- Inspect the SQL statements and their effect on existing data.
- Confirm the availability of an appropriate backup.
- Verify the relevant replication channel.
- Confirm that the application's schema-validation configuration is appropriate.

Execute a migration only once and only against its intended source database.

MySQL DDL statements may commit implicitly. A failed migration can leave partially applied schema changes.

Never blindly rerun a failed migration. Inspect the database and reconcile its actual state first.

## Replication

The Docker MySQL databases are authoritative sources.

The Windows MySQL instance acts as a replica and must not be directly modified as part of normal schema migration operations.

Replication transfers database changes but does not copy external files, including uploaded vehicle photographs stored in Docker volumes.

## Application Schema Management

Vehicle Service uses Hibernate schema validation in its MySQL profile.

Other services may currently use Hibernate automatic schema updates.

The long-term goal is explicit, version-controlled schema management for every service, with automated migrations introduced only after the existing databases have been safely baselined.

## Future Improvements

The project may later adopt Flyway for automated migration execution and schema history tracking.

Migration automation must not be enabled against existing databases without first reconciling their current schemas and baseline versions.

## Related Documentation

See `MIGRATION_HISTORY.md` for migration descriptions, execution status and verification records.