# Optional MySQL Replication

This guide describes an optional, one-way MySQL replication setup for Trivio.

Trivio works normally without replication. The standard installation only
requires the four MySQL databases managed by Docker Compose.

Replication is an advanced feature intended for development, learning,
database administration, and demonstrating multi-source replication.

## Overview

The Trivio replication topology consists of:

- Four independent Docker MySQL source servers
- One external MySQL 8.4 replica server
- Four named replication channels
- One destination database per channel

| Docker source | Database | Replication channel |
| --- | --- | --- |
| `vehicle-db` | `vehicle_db` | `trivio_vehicle` |
| `order-db` | `order_db` | `trivio_order` |
| `payment-db` | `payment_db` | `trivio_payment` |
| `users-db` | `users_db` | `trivio_users` |

Changes flow from Docker MySQL sources to the external replica.

The replication is asynchronous and one-way. It is not bidirectional
synchronization or a substitute for a verified backup.

**Vehicle image files are not replicated.** MySQL replication transfers
database rows and photo metadata, but not the physical files stored in
Trivio's `vehicle-media` Docker volume.

## Safety requirements

Before configuring replication:

1. Back up every database that could be affected.
2. Use a new external MySQL instance or four verified empty destination
   schemas for initial setup.
3. Never import an initial snapshot over populated destination schemas.
4. Keep unrelated databases outside the replication workflow.
5. Do not reset existing replication channels or replace their positions
   without a verified recovery plan.
6. Do not remove Docker volumes during replication configuration.
7. Never publish database passwords, binary log contents, or SQL backups.

If the external MySQL instance already contains important databases,
review the procedure carefully and prefer an isolated MySQL instance.

A replica connected to multiple sources must not have overlapping schema
ownership between channels.

## Requirements

- Docker and Docker Compose
- MySQL 8.4 source containers
- A compatible external MySQL server
- Administrative access to the source and replica instances
- MySQL client tools, including `mysql` and `mysqldump`
- A private directory for database snapshots
- An appropriate network and firewall configuration

For a Windows replica, MySQL Server can run as a Windows service.
For Linux, use the MySQL service manager provided by the distribution.

Keep the MySQL client tools compatible with the server version.

## 1. Configure private host networking

The public Compose files do not define a user's personal IP address
or host port assignments.

Copy `.env.example` to `.env` and configure the variables relevant
to your installation.

The optional source-port settings are:

- `TRIVIO_VEHICLE_REPLICATION_PORT`
- `TRIVIO_ORDER_REPLICATION_PORT`
- `TRIVIO_PAYMENT_REPLICATION_PORT`
- `TRIVIO_USERS_REPLICATION_PORT`
- `TRIVIO_BIND_ADDRESS`

Choose your own available host ports and a trusted bind address.

For an external MySQL server on the same host, loopback-only bindings
are recommended. If the replica runs on another computer, explicitly
configure secure network access, TLS, and firewall rules.

Do not publish MySQL replication ports directly to the public internet.

## 2. Enable the optional Compose configuration

Use both Compose files together:

```bash
docker compose -f docker-compose.yml -f compose.replication.yml config --quiet
```

On a brand-new installation, start the complete stack using:

```bash
docker compose -f docker-compose.yml -f compose.replication.yml up -d --build
```

The optional file configures separate MySQL server IDs and publishes
the source database ports using private environment variables.

It does not automatically create replication accounts, export database
snapshots, or configure the external replica.

**Existing installations:** Do not blindly run the `up` command.
First check which Compose project, volumes, containers, and replication
connections are already in use. A configuration change may recreate
containers or change the available source endpoints.

## 3. Verify MySQL source configuration

For each Docker database, verify:

```sql
SELECT
    @@server_id AS server_id,
    @@log_bin AS binary_logging,
    @@gtid_mode AS gtid_mode;
```

Each source needs a unique nonzero server ID and binary logging enabled.

The provided optional Compose configuration assigns distinct IDs.

This guide uses file-position-based replication rather than GTID
automatic positioning. All four sources and the replica must be
configured consistently with that choice.

Run read-only checks against the actual source instances.

## 4. Create dedicated replication accounts

On each source, create a dedicated account with replication privileges.

Use an account restricted to the appropriate replica client address
and a unique strong password.

Example SQL template:

```sql
CREATE USER '<REPLICATION_USER>'@'<ALLOWED_CLIENT_HOST>'
IDENTIFIED BY '<PRIVATE_REPLICATION_PASSWORD>';

GRANT REPLICATION SLAVE ON *.*
TO '<REPLICATION_USER>'@'<ALLOWED_CLIENT_HOST>';
```

Replace every placeholder privately.

The account should not be the application's MySQL user or root.

A MySQL user account is local to its source server, so repeat the
configuration for each source that the replica will contact.

Account-host matching depends on the source server's view of the
connecting client's address, which may differ from the host's address
when Docker networking is involved.

Verify authentication and network access before continuing.

Use TLS for connections crossing untrusted networks.

## 5. Prepare an initial consistent snapshot

Replication must begin from coordinates matching the data initially
loaded into the external replica.

For each of the four source servers:

1. Connect to the intended source only.
2. Produce a consistent SQL snapshot of its Trivio database.
3. Capture the source binary log filename and position associated
   with that snapshot.
4. Keep the snapshot and its coordinates together.
5. Store the files privately, outside the Git repository.

For MySQL 8.4, a suitable `mysqldump` template is:

```text
mysqldump
  --host=<SOURCE_HOST>
  --port=<SOURCE_HOST_PORT>
  --user=<BACKUP_USER>
  --password
  --single-transaction
  --quick
  --source-data=2
  --set-gtid-purged=OFF
  --databases <SOURCE_DATABASE>
  --result-file=<PRIVATE_SNAPSHOT_FILE>
```

This is a template, not a command to execute without replacing
the placeholders and adapting the syntax to your shell.

Use a separate snapshot for each of the four sources.

The backup account needs the privileges required by `mysqldump`,
including access to the source binary log coordinates.

`--source-data=2` includes the source file/position as a commented
SQL statement. Record the coordinates separately for each source.

For Windows PowerShell, `--result-file` avoids problems caused by
the shell's text-output redirection encoding.

Do not perform schema-changing operations during the snapshot,
because they can invalidate a consistent transactional export.

## 6. Initialize an empty external replica

Before importing:

- Confirm the destination server identity and version.
- Verify that its server ID is different from every Docker source.
- Confirm the four Trivio destination schemas are new or empty.
- Back up any existing unrelated databases.
- Ensure replication is not already applying events to these schemas.

Import each snapshot into its corresponding destination schema.

Use MySQL Workbench Data Import or a compatible MySQL command-line
client. On Windows, select an import method that preserves the
SQL file's encoding.

Never import a snapshot into a populated schema without an explicit
recovery or migration plan.

Do not copy MySQL's raw data-directory files between independently
running servers.

## 7. Configure channel-specific schema filters

A multi-source replica needs to know which database belongs to
which replication channel.

In the external MySQL server configuration, under `[mysqld]`,
the following options express the required mapping:

```ini
[mysqld]
replicate-do-db=trivio_vehicle:vehicle_db
replicate-do-db=trivio_order:order_db
replicate-do-db=trivio_payment:payment_db
replicate-do-db=trivio_users:users_db
```

Merge these settings into the existing server configuration rather
than replacing its entire configuration file.

Do not duplicate an existing filter configuration.

Verify how your MySQL version and binary logging format apply
database filters to your workloads.

On a shared MySQL instance, do not make unrelated databases globally
read-only simply to configure Trivio replication.

Configuration-file changes may require a controlled MySQL service
restart. Back up the configuration before making changes.

## 8. Configure the four replication channels

Use the initial snapshot coordinates recorded for each source.

For each channel, configure:

- Its own source host
- Its own source host port
- A dedicated replication account
- The snapshot's source binary log file
- The snapshot's source binary log position

Example for the Vehicle channel:

```sql
CHANGE REPLICATION SOURCE TO
    SOURCE_HOST='<YOUR_SOURCE_HOST>',
    SOURCE_PORT=<YOUR_SOURCE_HOST_PORT>,
    SOURCE_USER='<REPLICATION_USER>',
    SOURCE_PASSWORD='<PRIVATE_REPLICATION_PASSWORD>',
    SOURCE_LOG_FILE='<FILE_FROM_VEHICLE_SNAPSHOT>',
    SOURCE_LOG_POS=<POSITION_FROM_VEHICLE_SNAPSHOT>,
    SOURCE_AUTO_POSITION=0
FOR CHANNEL 'trivio_vehicle';
```

Use corresponding source details and snapshot coordinates for:

- `trivio_order`
- `trivio_payment`
- `trivio_users`

Never use another channel's snapshot coordinates.

This step is for new, unconfigured channels only. Do not overwrite
the coordinates of working channels.

Sensitive statements containing passwords must not be committed,
copied into public documentation, or shared in issue reports.
Use secure connections and protect database administration history.

Depending on the selected authentication and TLS configuration,
additional MySQL source connection options may be required.

## 9. Start and inspect replication

For newly initialized channels, start each one individually:

```sql
START REPLICA FOR CHANNEL 'trivio_vehicle';
START REPLICA FOR CHANNEL 'trivio_order';
START REPLICA FOR CHANNEL 'trivio_payment';
START REPLICA FOR CHANNEL 'trivio_users';
```

Then inspect all channels:

```sql
SHOW REPLICA STATUS;
```

Check that:

- `Replica_IO_Running` is `Yes`
- `Replica_SQL_Running` is `Yes`
- `Last_IO_Errno` is `0`
- `Last_SQL_Errno` is `0`
- `Seconds_Behind_Source` approaches `0`

A lag value of zero is useful, but does not by itself prove that
every source and destination table is identical.

You can also inspect replication processes:

```sql
SELECT
    c.CHANNEL_NAME,
    c.SERVICE_STATE AS receiver_state,
    a.SERVICE_STATE AS applier_state,
    c.LAST_ERROR_NUMBER AS receiver_error
FROM performance_schema.replication_connection_status c
JOIN performance_schema.replication_applier_status a
    ON c.CHANNEL_NAME = a.CHANNEL_NAME
ORDER BY c.CHANNEL_NAME;
```

Inspect SQL worker failures separately:

```sql
SELECT
    CHANNEL_NAME,
    WORKER_ID,
    SERVICE_STATE,
    LAST_ERROR_NUMBER,
    LEFT(LAST_ERROR_MESSAGE, 200) AS error_message
FROM performance_schema.replication_applier_status_by_worker
ORDER BY CHANNEL_NAME, WORKER_ID;
```

Stop and investigate unexpected errors before configuring further
channels or attempting any form of recovery.

## 10. Verify replicated data

Compare row counts and checksums between each source and destination.

Examples:

```sql
SELECT COUNT(*) FROM vehicle_db.vehicles;

CHECKSUM TABLE vehicle_db.vehicles EXTENDED;
```

Repeat these checks for all Trivio tables, including:

- `users_db.users`
- `users_db.owner_bootstrap`
- `vehicle_db.vehicles`
- `vehicle_db.vehicle_photos`
- `order_db.purchase_orders`
- `payment_db.payment_attempts`

Matching checksums are useful evidence of consistency, but checksums
alone are not a complete proof of correctness.

When validating a live, changing database, coordinate the comparison
with the replication position so writes do not invalidate the comparison.

Do not expose user records, password hashes, or tokens in screenshots.

## 11. Automatic replication startup

MySQL supports the startup option:

```ini
[mysqld]
skip-replica-start=OFF
```

With this setting, configured replication channels can start
automatically when the external MySQL server starts.

If `skip-replica-start=ON`, channels remain stopped until explicitly
started.

For a Windows installation, inspect the MySQL service configuration
and identify its active MySQL option file.

For Linux, inspect the relevant MySQL service and option files.

Before changing anything:

1. Back up the server configuration.
2. Verify which option file the service actually uses.
3. Change only the intended replication startup setting.
4. Validate the MySQL configuration.
5. Plan a controlled restart.
6. Verify the channels start automatically afterward.

Restarting a shared MySQL server temporarily disconnects all clients,
including clients accessing unrelated databases.

If Docker starts after the external MySQL server, replication may
temporarily wait for its sources. Inspect connectivity and error
status after Docker becomes available.

Do not assume automatic recovery from every replication failure.

## 12. Troubleshooting

### Replication channels are stopped

Check `skip_replica_start`, MySQL service startup settings, and the
saved channel state.

Do not reset the channels merely because they are stopped.

### The source is temporarily unreachable

Check the intended source binding, configured private host port,
Docker container state, firewall, replication account, and TLS.

Do not expose the source publicly to resolve a local connectivity
problem.

### A required binary log is missing

Do not guess a new binary log position or skip transactions.

Recover from a verified consistent snapshot or another documented
recovery procedure.

### Replica SQL workers report errors

Inspect `replication_applier_status_by_worker` and the server error log.

Do not skip failing transactions without identifying the root cause.

### Row counts or checksums differ

Check lag, filters, source identity, initial snapshot coordinates,
and the possibility of writes made directly on the replica.

Stop and investigate before attempting changes that could overwrite data.

### Vehicle pictures are missing on the external server

This is expected if only MySQL replication is configured.

Vehicle picture files live in the separate persistent `vehicle-media`
Docker volume. They require an independent storage or backup strategy.

## 13. Safe shutdown and maintenance

Normal Docker restarts preserve named volumes.

Do not delete database or media volumes when troubleshooting
replication.

Never use destructive reset, purge, or reinitialization operations
without a verified recovery plan.

Before changing source IDs, host ports, network bindings, replica
filters, or replication coordinates, record the existing configuration
and back up affected databases.

## Security and limitations

This setup is intended for educational and controlled development use.

- Use least-privilege MySQL accounts.
- Prefer local-only or otherwise trusted network paths.
- Use TLS when traffic crosses an untrusted network.
- Store credentials outside version control.
- Monitor replication errors and disk space.
- Retain source binary logs long enough for expected replica outages.
- Keep independent, restorable backups.
- Avoid direct writes to replicated destination schemas.

Asynchronous replication does not eliminate the possibility of
lag, data inconsistency, or failure.

## Official MySQL documentation

- https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html
- https://dev.mysql.com/doc/refman/8.4/en/change-replication-source-to.html
- https://dev.mysql.com/doc/refman/8.4/en/replication-rules-channel-based-filters.html
- https://dev.mysql.com/doc/refman/8.4/en/show-replica-status.html
