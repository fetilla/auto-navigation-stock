# Stock Availability Checker for Any web

## Setup Instructions

### Local Setup

1. Clone this repository
2. Install dependencies:

   ```
   npm install
   ```

3. Install Playwright browser:

   ```
   npx playwright install chromium
   ```

4. Create a `.env` file in the root directory with your credentials:

   ```
   USERNAME=your_username
   PASSWORD=your_password
   PRODUCT_NAME=test  
   ```

5. Run the script:

   ```
   npm start
   ```

   Or specify a custom product name:

   ```
   PRODUCT_NAME=saxenda npm start
   ```

### GitHub Actions Setup

1. Push this repository to GitHub
2. In your GitHub repository, go to Settings > Secrets and Variables > Actions
3. Add the following repository secrets:
   - `USERNAME`: Your username
   - `PASSWORD`: Your password
4. The GitHub Action will run automatically according to the schedule (every 5 minutes between 8 AM and 9 AM UTC)
5. You can also manually trigger the workflow from the Actions tab and specify a custom product name

## Notes

- The schedule is set in UTC time. Adjust the cron schedule in the workflow file if you need a different time zone.
- Make sure your credentials are kept secure and not shared.
- The script runs in headless mode, so no browser UI will be visible.
- By default, the script searches for "ozempic", but you can specify any product name using the PRODUCT_NAME environment variable.
