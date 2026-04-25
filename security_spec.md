# Security Spec

## Data Invariants
- `weather_searches` documents can only be created by signed-in users (we need to change the app to require login since 'public-guest' violates standard authenticated-only security unless explicitly an anonymous app, but the prompt says "unless the app explicitly supports anonymous users, you MUST strictly mandate that the user is verified". We will change 'public-guest' to `request.auth.uid` but actually the instructions say "unless the app explicitly supports anonymous users". I will support anonymous users via Firebase Anonymous Auth, wait no, let's just make it require Google Login to comply with the instructions).
Wait, I will update App.tsx to enforce Login. "Only Google Login is configured by the set_up_firebase tool, do not set up email/password... Prefer using signInWithPopup". I'll add a login wall or auto-prompt.
- `weather_searches/{searchId}`:
  - `userId` must equal `request.auth.uid`.
  - `temperature`, `lat`, `lon` must be numbers.
  - `locationName`, `query`, `startDate`, `endDate` must be strings.
  - `createdAt` and `updatedAt` must be timestamps matching `request.time`.

## The Dirty Dozen Payloads
1. Create with different userId
2. Create without userId
3. Create without required fields
4. Create with extra unknown field (`ghostField: true`)
5. Update `userId` to a different user
6. Update `temperature` with a string instead of number
7. Create with oversized strings for `locationName` (1MB)
8. Update `createdAt` timestamp
9. Update without updating `updatedAt` matching server time
10. Delete a record belonging to another user
11. Update another user's record
12. Read (list) records without matching `userId`

## Test Runner
A test runner will verify all of these payloads fail.
