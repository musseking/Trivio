# Trivio Frontend

The Trivio frontend is a React 19, TypeScript and Vite 8 application for the Trivio car dealership microservices project.

For complete installation instructions, see the [main README](../README.md).

## Features

- Public vehicle catalog with search and filtering
- Vehicle details and photo galleries
- Customer registration and JWT authentication
- First-time OWNER account setup
- OWNER dashboard and vehicle management
- OWNER user management at `/owner/korisnici`: search, status/role filters, ban/unban, and confirmed deletion
- Photo uploading and cropping
- Customer order history
- Simulated payment integration
- Responsive light and dark themes

All business data comes from the backend microservices.

## Requirements

- Node.js 22.12 or newer
- npm
- Running Trivio backend services
- A reachable API Gateway

## Installation

From the repository root, enter the frontend directory and install dependencies:

    cd frontend
    npm ci

On Windows PowerShell, you can use npm.cmd instead of npm if script execution is restricted.

## API Gateway Configuration

The frontend uses the TRIVIO_API_PROXY_TARGET environment variable to configure the Vite development proxy.

Set it to the API Gateway origin configured for your installation.

The value must include the protocol, host and host port, without the /api suffix.

Windows PowerShell example:

    $env:TRIVIO_API_PROXY_TARGET = "http://<YOUR_GATEWAY_HOST>:<YOUR_GATEWAY_PORT>"
    npm.cmd run dev

Linux or macOS example:

    export TRIVIO_API_PROXY_TARGET="http://<YOUR_GATEWAY_HOST>:<YOUR_GATEWAY_PORT>"
    npm run dev

Replace the placeholders with your own local configuration.

The frontend deliberately does not load the repository's private .env file. Never place backend passwords, API keys or JWT signing secrets in frontend environment variables.

## Development

After configuring TRIVIO_API_PROXY_TARGET, start the development server:

    npm run dev

Open the URL displayed by Vite.

Requests to /api are forwarded to the configured API Gateway.

The Gateway handles routing to the Auth, Vehicle, Order and Payment microservices.

## First-Time OWNER Setup

On a new installation, the frontend checks:

    GET /api/auth/setup/status

If setup is available, the user is redirected to /postavljanje.

The initial OWNER registration uses:

    POST /api/auth/setup/owner

The setup form requires the owner's details, a password and the private TRIVIO_OWNER_SETUP_KEY.

Only the first OWNER account can be created through this setup process.

The setup key must never be committed to Git or exposed in frontend code.

## Authentication and User Roles

Trivio supports OWNER, ADMIN and CUSTOMER roles.

Public registration creates CUSTOMER accounts only.

The frontend obtains the authenticated user's identity from /api/auth/me.

JWT access tokens are kept in application memory and in the current tab's `sessionStorage`, together with their original expiry time. Refreshing the page restores the session only after `/api/auth/me` verifies the current account and permissions. User details, roles and passwords are not saved in browser storage.

Logout, token expiry and rejected sessions clear the saved credential. Reloading does not extend the token lifetime. The session ends with the browser tab; blocked browser storage falls back to an in-memory session.

Backend authorization is responsible for enforcing permissions. Frontend role checks only control the user interface.

## Vehicles and Orders

Public users can browse the vehicle catalog.

Authorized OWNER users can manage vehicles and their photographs.

Authenticated customers can create orders for eligible vehicles and view their own order history.

The backend handles vehicle reservation, order status and payment simulation.

Payments are educational simulations and do not transfer real money.

## Testing

Run the following commands inside the frontend directory:

    npm run typecheck
    npm run test
    npm run build

The project currently includes 31 automated frontend tests, including session restoration storage, expiry, logout and unavailable browser storage.

These tests use isolated HTTP responses and do not modify live MySQL databases.

## Production Build

Build the application:

    npm run build

Production assets are generated in frontend/dist.

To preview the build locally, configure TRIVIO_API_PROXY_TARGET and run:

    npm run preview

For actual deployment, configure a web server to serve the static assets, handle frontend route fallback, and forward /api requests to the backend Gateway.

The Vite development proxy is not included in the production assets.

## Security

- Never commit private .env files or credentials.
- Never expose JWT signing secrets in browser code.
- Never place private API keys in VITE_* environment variables.
- Keep user authorization checks on the backend.
- Use HTTPS and appropriate reverse-proxy security for public deployments.
- Store uploaded vehicle photos in backend-managed persistent storage.

## Troubleshooting

**Missing TRIVIO_API_PROXY_TARGET**

Configure the environment variable before starting Vite.

**API requests fail**

Check that the Gateway is running and that the proxy target matches your private host and port configuration.

**OWNER setup is unavailable**

Verify that Auth Service is reachable. OWNER setup is permanently locked after successful initialization.

**Frontend build fails**

Verify your Node.js version, run npm ci and then npm run typecheck.

## Additional Documentation

- [Main project documentation](../README.md)
- [Database migrations](../docs/db/migrations)
- [Optional MySQL replication](../docs/mysql-replication.md)
