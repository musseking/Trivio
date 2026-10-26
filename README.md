# Trivio

**Trivio** is a component-based car dealership management application developed as a university project.

It demonstrates a microservice architecture with centralized configuration, service discovery, API routing, authentication, independent databases, vehicle inventory management, purchase orders, and simulated payments.

The project includes a React web application for customers and dealership administrators.

> **Educational project:** Payments are simulated. Trivio does not process real money or connect to a banking provider.

## Features

- Public vehicle catalog with search, filtering, and vehicle details
- Customer registration and JWT authentication
- Cropped profile photos with authenticated access, image preview, and metadata removal
- Secure first-time OWNER account setup
- OWNER vehicle inventory management
- OWNER user management with search, account banning/unbanning, and confirmed account deletion
- Vehicle photo uploads, gallery management, and cropping
- Vehicle reservation and purchase order workflows
- Simulated successful and declined payments
- Protection against purchasing unavailable or already sold vehicles
- User-specific order history
- Responsive React interface with light and dark themes
- Persistent MySQL storage using Docker volumes
- Optional MySQL replication to an external server

## Architecture

Trivio uses independent Spring Boot services communicating through REST APIs.

| Component | Responsibility |
| --- | --- |
| API Gateway | Single API entry point and request routing |
| Auth Service | Users, authentication, JWT, and first-time OWNER setup |
| Vehicle Service | Inventory, vehicle states, and photo management |
| Order Service | Reservations and purchase orders |
| Payment Service | Educational payment simulation |
| Discovery Server | Eureka service registration and discovery |
| Config Server | Centralized Spring Cloud configuration |
| React Frontend | Customer storefront and administration interface |

### Technology stack

**Backend**
- Java 25
- Spring Boot 4.1
- Spring Cloud 2025.1.2
- Spring Cloud Gateway
- Eureka Discovery
- OpenFeign
- Maven

**Frontend**
- React 19
- TypeScript
- Vite 8
- React Router

**Infrastructure**
- Docker and Docker Compose
- MySQL 8.4
- Independent databases for authentication, vehicles, orders, and payments
- Persistent Docker volumes

### Database architecture

The application uses four independent databases:

| Database | Service |
| --- | --- |
| `users_db` | Auth Service |
| `vehicle_db` | Vehicle Service |
| `order_db` | Order Service |
| `payment_db` | Payment Service |

Vehicle image files are stored separately in a persistent Docker volume.

The curated demonstration inventory, licensed photo sources, import instructions,
and preservation checks are documented in [`docs/catalog`](docs/catalog/README.md).

SQL schema initialization scripts and migration history are located in
[`docs/db/migrations`](docs/db/migrations).

Existing database volumes are preserved across normal container restarts.

## Prerequisites

For the recommended Docker installation:

- Git
- Docker Desktop or Docker Engine
- Docker Compose
- Node.js 22.12 or newer
- npm

Node.js 24 was used during project verification.

For development outside Docker, Java 25 and Maven 3.9 or newer are also required.

## Quick Start — Docker

This is the recommended way to run Trivio.

### 1. Clone the repository

```bash
git clone https://github.com/musseking/Trivio.git
cd Trivio
```

The clone URL above points to the official Trivio repository.

### 2. Create your private environment configuration

Copy the example configuration:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**Linux / macOS**

```bash
cp .env.example .env
```

Edit `.env` and replace every placeholder with a valid value.

The main security settings are:

| Variable | Purpose |
| --- | --- |
| `TRIVIO_DB_PASSWORD` | Application MySQL user password |
| `TRIVIO_MYSQL_ROOT_PASSWORD` | MySQL root password for new Docker databases |
| `TRIVIO_INTERNAL_API_KEY` | Authentication of internal service requests |
| `TRIVIO_JWT_SECRET_BASE64` | Base64-encoded JWT signing secret |
| `TRIVIO_OWNER_SETUP_KEY` | Authorization key for creating the first OWNER |

Generate strong, independent random values for every new installation.

The JWT secret must contain at least 32 random bytes before Base64 encoding.

On Windows, the following PowerShell example generates a random Base64 value:

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $rng.GetBytes($bytes)
}
finally {
    $rng.Dispose()
}
[Convert]::ToBase64String($bytes)
```

Generate separate values for the different secrets.

Never publish your generated values, copy them into frontend source code, or commit `.env`.

### 3. Configure local networking

The `.env.example` file also contains:

- `TRIVIO_BIND_ADDRESS`
- Host port settings for the API Gateway and backend services
- Optional host port settings for MySQL replication

Choose a local loopback binding and unused host ports appropriate for your own computer.

The host port numbers are installation-specific. They are not hardcoded into the public Docker Compose configurations.

Use distinct host ports for services that are published on the same host.

The MySQL replication port settings are needed only when the optional replication configuration is enabled.

### 4. Validate Docker configuration

```bash
docker compose config --quiet
```

If the command reports missing variables, review your private `.env`.

### Recommended: One-command development startup

Trivio includes a unified development launcher.

After configuring the private `.env` file and installing
Docker and Node.js, run `npm run dev` from the repository root.

The launcher automatically:

1. Builds backend images from current sources, then starts Docker Compose services and MySQL databases. Unchanged build layers are cached.
2. Waits for the API Gateway and authentication setup endpoint.
3. Installs frontend dependencies if necessary.
4. Starts the Vite development server.

Open `http://localhost:5173/` in your browser.

Additional commands:

- `npm run dev:build` - Alias for `npm run dev`; both rebuild backend images before starting development.
- `npm run dev:status` - Show Docker service status.
- `npm run dev:stop` - Stop Docker services without deleting volumes.

Press Ctrl+C to stop Vite. Docker containers remain running.

The manual startup procedure is documented below.


### 5. Build and start the application

```bash
docker compose up -d --build
```

The first build may take several minutes while Docker downloads dependencies and compiles the Java services.

Check container status:

```bash
docker compose ps
```

All four MySQL containers should become healthy.

The API Gateway is available at the bind address and Gateway host port configured in your `.env`.

The application routes its APIs through the Gateway under the `/api` prefix.

### 6. Start the React frontend

The frontend is located in the `frontend` directory.

The Vite development server requires `TRIVIO_API_PROXY_TARGET` to point to your API Gateway.

For Windows PowerShell, from the repository root:

```powershell
$settings = @{}

Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*(TRIVIO_BIND_ADDRESS|TRIVIO_GATEWAY_HOST_PORT)=(.+)$') {
        $settings[$Matches[1]] = $Matches[2].Trim()
    }
}

if (-not $settings.TRIVIO_BIND_ADDRESS -or
    -not $settings.TRIVIO_GATEWAY_HOST_PORT) {
    throw "Missing Gateway networking settings in .env."
}

$env:TRIVIO_API_PROXY_TARGET = "http://$($settings.TRIVIO_BIND_ADDRESS):$($settings.TRIVIO_GATEWAY_HOST_PORT)"

Set-Location frontend

npm.cmd ci
npm.cmd run dev
```

Open the local URL printed by Vite.

For other operating systems, set the same environment variable in your shell before running:

```bash
npm ci
npm run dev
```

The frontend does not load backend `.env` secrets into browser code.

## First-Time OWNER Setup

On a brand-new database, the application checks:

`GET /api/auth/setup/status`

When setup is available, the React frontend redirects to the first-time OWNER registration page.

To create the first OWNER:

1. Open the frontend in your browser.
2. Follow the first-time setup screen.
3. Enter the owner's name, email address, and password.
4. Enter the `TRIVIO_OWNER_SETUP_KEY` value from your private `.env`.
5. Submit the form.
6. Sign in using the new OWNER account.

Only one initial OWNER account can be created through this process.

After successful setup, the database records that OWNER initialization has been completed. Subsequent attempts to repeat the setup are rejected.

**Never expose the OWNER setup key in a public repository, issue, screenshot, or log.**

For an existing installation, do not repeat initial OWNER setup or rerun already applied database migrations.

## User Roles

Trivio supports three account roles:

| Role | Description |
| --- | --- |
| `OWNER` | Dealership owner and primary administrator |
| `ADMIN` | Administrative access according to backend authorization rules |
| `CUSTOMER` | Regular registered customer |

Public account registration creates CUSTOMER accounts.

Users cannot obtain OWNER privileges by submitting an arbitrary role during registration.

Backend authorization is responsible for enforcing permissions.

## Vehicle and Purchase Workflow

The purchase workflow coordinates the Vehicle, Order, and Payment services.

1. An authorized administrator creates an available vehicle.
2. A registered customer creates an order for that vehicle.
3. Order Service requests a reservation through Vehicle Service.
4. The order becomes `PENDING`, and the vehicle becomes `RESERVED`.
5. A declined simulated payment is recorded as `FAILED`.
6. A successful simulated payment confirms the order.
7. The vehicle becomes `SOLD`, and the order becomes `CONFIRMED`.

Attempts to reserve an unavailable or already sold vehicle are rejected.

Payment approval is supplied to an educational simulator. It is **not** a secure real-world payment integration.

Operations spanning multiple microservices are not one distributed ACID transaction.

## API Overview

The API Gateway forwards requests to the appropriate microservices under the `/api` prefix.

The following routes are defined by the backend controllers.

For manual API testing, see [HTTP examples](api-demo/trivio.http) and the [Postman collection](api-demo/Trivio.postman_collection.json). Configure your own Gateway address and authentication token locally.

### Authentication and users

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/auth/setup/status` | Check initial OWNER setup |
| POST | `/api/auth/setup/owner` | Create the first OWNER |
| POST | `/api/auth/register` | Register a CUSTOMER |
| POST | `/api/auth/login` | Authenticate |
| GET | `/api/auth/me` | Get the authenticated user |
| GET | `/api/auth/admin/users` | Administrative user list |
| PUT | `/api/auth/admin/users/{id}/role` | Update a user's role |

### Vehicles and photographs

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/vehicles` | Browse vehicles |
| GET | `/api/vehicles/{id}` | View vehicle details |
| GET | `/api/vehicles/manage` | Owner inventory management |
| POST | `/api/vehicles` | Create a vehicle |
| PUT | `/api/vehicles/{id}` | Update vehicle details |
| DELETE | `/api/vehicles/{id}` | Delete a vehicle |
| POST | `/api/vehicles/{id}/archive` | Archive a vehicle |
| POST | `/api/vehicles/{id}/restore` | Restore an archived vehicle |
| GET | `/api/vehicles/{id}/photos` | List vehicle photographs |
| GET | `/api/vehicles/media/{filename}` | Retrieve a stored JPEG |
| POST | `/api/vehicles/{id}/photos` | Upload photographs |
| PUT | `/api/vehicles/{id}/photos/order` | Reorder photographs |
| PUT | `/api/vehicles/{id}/photos/{photoId}` | Replace a photograph |
| DELETE | `/api/vehicles/{id}/photos/{photoId}` | Remove a photograph |

### Orders

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/orders` | List orders subject to authorization |
| GET | `/api/orders/mine` | View the current user's orders |
| GET | `/api/orders/{id}` | View an authorized order |
| POST | `/api/orders` | Create an order |
| POST | `/api/orders/{id}/cancel` | Cancel an order |

### Simulated payments

| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/payments` | List payments subject to authorization |
| GET | `/api/payments/{id}` | View a payment |
| GET | `/api/payments/order/{id}` | View payments for an order |
| POST | `/api/payments` | Execute an educational payment simulation |

### Internal business operations

The following endpoints participate in service-to-service workflows and must not be treated as unrestricted customer operations:

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/vehicles/{id}/reserve` | Reserve a vehicle |
| POST | `/api/vehicles/{id}/release` | Release a reservation |
| POST | `/api/vehicles/{id}/sell` | Mark a vehicle as sold |
| POST | `/api/orders/{id}/confirm` | Confirm an order |

Authentication, roles, resource ownership, and internal service authorization are enforced by backend code. A route appearing in this table does not mean it is publicly accessible.

Authenticated requests require the appropriate Bearer JWT. Internal operations may additionally require service-specific credentials.

Payments are simulated for educational purposes and do not transfer real money.

## Frontend Development and Testing

From `frontend`:

```bash
npm ci
npm run typecheck
npm run test
npm run build
```

`npm run build` performs TypeScript validation and builds the production frontend into `dist/`.

The frontend test suite contains 24 automated tests covering API behavior, owner setup contracts, image handling, and related functionality.

For a local production preview, configure `TRIVIO_API_PROXY_TARGET` before running:

```bash
npm run preview
```

Production hosting must separately configure frontend route fallback and reverse-proxy forwarding of `/api` requests.

## Data Persistence and Safe Shutdown

Trivio uses persistent Docker volumes for the four databases and uploaded vehicle images.

To stop the services without deleting volumes:

```bash
docker compose stop
```

To stop and remove the application containers and networks while preserving named volumes:

```bash
docker compose down
```

**Never use `docker compose down -v` on an installation containing data you want to keep.**

Docker database initialization SQL files are executed when a database volume is first initialized. They are not a general-purpose migration runner for existing installations.

Before modifying database schemas, consult the migration history and make backups.

## Optional MySQL Replication

Trivio can optionally replicate its four Docker MySQL databases to an external MySQL 8.4 server.

The optional configuration is provided in:

`compose.replication.yml`

This is a one-way, asynchronous source-to-replica configuration.

It is not required for normal Trivio operation.

The replication configuration:

- Uses four independent MySQL sources
- Requires distinct MySQL server IDs
- Exposes source connections only through user-configured host bindings
- Uses separate replication channels and schema filters
- Requires a consistent initial data snapshot and correctly configured replication coordinates

See [Optional MySQL Replication Guide](docs/mysql-replication.md) for setup and verification.

**Important:** MySQL replication transfers database changes. It does not copy physical vehicle image files from the Docker media volume.

Do not enable replication against an existing database server without backups and verifying that destination schemas will not conflict with existing data.

## Security Notes

- Do not commit `.env`, generated secrets, backups, or database files.
- Use unique, strong secrets for each installation.
- Restrict exposed services to appropriate local or trusted network interfaces.
- Do not expose internal service endpoints or database ports directly to the public internet.
- Do not reuse demonstration credentials in a real deployment.
- Use HTTPS and production security controls before any public deployment.
- Do not treat simulated payment approval as a real payment authorization.
- Database credentials in already initialized MySQL volumes must be rotated through a deliberate database credential-change procedure; changing `.env` alone does not change existing MySQL users.

## Troubleshooting

**Docker reports a missing variable**

Review `.env` and ensure every required setting has a real value.

**A database container is unhealthy**

Check its logs and verify that the configured database credentials match the credentials of its initialized volume.

**The frontend cannot reach the backend**

Confirm that the Gateway is running and that `TRIVIO_API_PROXY_TARGET` points to the configured Gateway host binding and port.

**First-time OWNER setup is unavailable**

Check the Auth Service and database state. Setup is intentionally locked after the first OWNER is created.

**A vehicle cannot be purchased**

Check the vehicle status. Only vehicles eligible for reservation can enter a new purchase workflow.

**Existing data is missing after changing Docker project names**

Docker Compose project names affect resource names, including volumes. Verify the selected project and volumes before creating or modifying resources.

## Project Status

Trivio is an educational application intended to demonstrate component-based development, microservice communication, authorization, persistence, and business workflow orchestration.

The project has been exercised using a fresh Git clone, independent Docker databases, authentication tests, purchase-flow integration checks, and frontend automated tests.

These checks do not constitute a complete production security audit.
