# Trivio frontend OWNER setup and theme update

## Scope

This frontend source snapshot includes:

- A first-installation OWNER setup gate connected to the real Auth Service V002 endpoints.
- A dedicated installation screen with password confirmation and a server-side setup key.
- Fail-closed startup when setup status cannot be verified, with retry controls.
- Native responsive dark/light styling across public, account and OWNER screens.
- Dark Reader lock to avoid double inversion, plus saved user theme choice.
- The correctly capitalized `Trivio.` brand in the header and footer.
- Four additional mocked API contract checks for the OWNER setup workflow.

No database migrations, Java backend files or `.env` secrets are included here.

## Install into an existing Windows working tree

1. Back up the current `frontend` directory or record uncommitted changes.
2. Extract the **changes-only** archive into the **Trivio repository root**, preserving paths,
   replacing only the files named in the archive. Do not delete `node_modules` or `dist`
   merely to install the patch.
3. Run `cd frontend`, then `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`.
4. Keep the Auth V002 migration as already applied; **never run it a second time**.
5. Test with the existing installation: setup status is false and regular pages display.
6. On an isolated fresh installation: setup status is true, setup prompts for key,
   submitting the first OWNER closes setup, and the user signs in afterward.

## Important operational notes

- The frontend uses Vite's `/api` development proxy at `http://127.0.0.1:8080`.
- Never publish `TRIVIO_OWNER_SETUP_KEY`; its value is not bundled in the frontend.
- No existing user accounts or vehicle records are modified by frontend changes.
- Dark Reader recognizes `<meta name="darkreader-lock">`. Trivio's own theme toggle
  should be used when Dark Reader is installed and enabled.
