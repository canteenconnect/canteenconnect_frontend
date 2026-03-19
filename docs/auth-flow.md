# Student Portal Auth Flow

The student portal uses the shared FastAPI backend at `VITE_BACKEND_URL`.

## Login

1. The login form posts `application/x-www-form-urlencoded` credentials to `POST /token`.
2. The backend returns:
   - `access_token`
   - `refresh_token`
   - `user`
3. The portal stores both tokens in local storage through `client/src/lib/api/tokenStore.ts`.

## Authenticated Requests

- `client/src/lib/api/client.ts` attaches the current access token to axios requests.
- If the backend returns `401`, the client sends the stored refresh token to `POST /auth/refresh`.
- On success, the portal replaces both stored tokens and retries the failed request once.

## Session Recovery

- `use-auth.ts` calls `ensureStudentAccessToken()` before loading `/auth/me`.
- If only the refresh token remains valid, the portal silently restores the session.

## Logout

1. The portal calls `POST /auth/logout`.
2. The current access token is sent as a bearer token.
3. The current refresh token is sent in the JSON body.
4. Local tokens are cleared regardless of whether the network call succeeds.
