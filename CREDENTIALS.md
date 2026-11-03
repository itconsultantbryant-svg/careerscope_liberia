# CareerScope account access

Production: https://careerscope-liberia.vercel.app/login

| Role | Email |
| --- | --- |
| Admin | admin@careerscope.lib |
| Student | student@test.com |
| Counselor | counselor@test.com |

The previously documented demo passwords were rotated before deployment.
**Current passwords are stored locally in ignored `server/.env.accounts.local`**,
under separate `production` and `preview` keys. Do not commit or publicly share
that file. The running local Neon API uses the production account passwords.

Choose the matching role on the login page. To reset a password, use
`server/scripts/set-password.js` with the new password supplied through a secure
`NEW_PASSWORD` environment variable, or the admin user-management interface.
