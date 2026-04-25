# How's the Weather?

SkyBound is a weather application showcasing persistence with full CRUD functionality, API data retrieval, and error handling. It allows users to authenticate, query weather for date ranges, store those queries, and view logs of their historical searches along with interactive charts and exports.

## What Was Done
1. **Authentication:** Integrated Google Login via Firebase Authentication to secure the application.
2. **Database Schema & Persistence:** Configured Firestore (NoSQL) to store persistent weather searches. 
3. **CRUD Operations:** 
   * **CREATE:** Built a search tool that takes a location and a date range, fetches data via Gemini (for location parsing) and Open-Meteo, and saves the temperature, dates, lat/lon, and search details into the database. Validates that dates are sensical and locations resolve correctly. 
   * **READ:** Added a query to grab all existing historical records from the database across all users without segmenting by individual user permissions (row-level security is not applied for read access, meaning it queries globally).
   * **UPDATE:** Created an inline editing interface allowing users to update their personal notes attached to historical records, or correct the location/temperature variables as needed. Validates fields before updating.
   * **DELETE:** Added UI to delete records from the persistent cloud database.
4. **Security & Rules:** Structured comprehensive Firestore rules to validate updates and creations, enforcing schema integrity, checking sizes, and assuring users can edit and delete any entries while retaining global read access.

## How to Run Locally
1. **Prerequisites**: Node.js v18+ 
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Environment setup**: Set up a `.env` file with your `GEMINI_API_KEY`. The included `firebase-applet-config.json` handles the Firestore integration configuration. 
4. **Start the Application**:
   ```bash
   npm run dev
   ```
