const { chromium } = require("playwright");
require("dotenv").config();

// Environment variables
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
const PRODUCT_NAME = process.env.PRODUCT_NAME || "ozempic";
const DEBUG_MODE = process.env.DEBUG_MODE === "true";
const SLOW_MO = process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0;
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || "./screenshots";
const TABLE_LOAD_DELAY = process.env.TABLE_LOAD_DELAY
  ? parseInt(process.env.TABLE_LOAD_DELAY)
  : 3000; // Default delay of 3 seconds

// Check if credentials are provided
if (!USERNAME || !PASSWORD) {
  console.error(
    "Error: Missing credentials. Please provide USERNAME and PASSWORD environment variables."
  );
  process.exit(1);
}

async function checkProductStock() {
  console.log(`Starting ${PRODUCT_NAME} stock check...`);
  console.log(`Debug mode: ${DEBUG_MODE ? "ON" : "OFF"}`);

  if (DEBUG_MODE) {
    console.log(`Slow motion delay: ${SLOW_MO}ms`);
    const fs = require("fs");
    // Create screenshots directory if it doesn't exist
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
      console.log(`Created screenshots directory at ${SCREENSHOTS_DIR}`);
    }
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: !DEBUG_MODE, // Run in headed mode if debug is true
    slowMo: SLOW_MO, // Slow down execution in debug mode
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Function to take screenshots in debug mode
    async function debugScreenshot(name) {
      if (DEBUG_MODE) {
        const screenshotPath = `${SCREENSHOTS_DIR}/${Date.now()}-${name}.png`;
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved: ${screenshotPath}`);
      }
    }

    // Navigate to Hefame website
    console.log("Navigating to Hefame website...");
    await page.goto("https://www.hefame.es/");
    await debugScreenshot("homepage");

    // Click on "Acceder" button
    console.log("Clicking on Acceder...");
    await page.click("text=Acceder");
    await debugScreenshot("after-acceder");

    // Click on "Acceso Único" button
    console.log("Clicking on Acceso Único...");
    await page.click("text=Acceso Único");
    await debugScreenshot("after-acceso-unico");

    // Wait for login page to load
    console.log("Waiting for login page...");
    await page.waitForLoadState("networkidle");
    await debugScreenshot("login-page");

    // Fill in username and password
    console.log("Entering credentials...");
    await page.fill('input[placeholder="Usuario"]', USERNAME);
    await page.fill('input[placeholder="Contraseña"]', PASSWORD);
    await debugScreenshot("credentials-filled");

    // Click login button
    console.log("Logging in...");
    await page.click("button.submit-button");
    await debugScreenshot("after-login");

    // Wait for dashboard to load
    console.log("Waiting for dashboard to load...");
    await page.waitForLoadState("networkidle");
    await debugScreenshot("dashboard");

    // Search for the product
    console.log(`Searching for ${PRODUCT_NAME}...`);
    await page.fill("input#material", PRODUCT_NAME);
    await page.press("input#material", "Enter");
    await debugScreenshot("search-entered");

    // Wait for results table to load
    console.log("Waiting for search results...");
    await page.waitForSelector("table#datosTabla", { timeout: 30000 });
    await debugScreenshot("search-results");

    // Adding a delay to ensure the table fully loads
    console.log(
      `Waiting for an additional ${TABLE_LOAD_DELAY}ms to ensure table fully loads...`
    );
    await page.waitForTimeout(TABLE_LOAD_DELAY);

    // Check if any product is available
    const rows = await page.$$("table#datosTabla tbody tr");
    console.log(`Found ${rows.length} results in the table.`);

    let foundStock = false;

    // Process each row
    for (const row of rows) {
      // Check if the row has an "Add to cart" button
      const addToCartCell = await row.$("td:nth-child(3)");

      if (addToCartCell) {
        // Look for the image inside the cell and check its title
        const addButton = await addToCartCell.$("img");

        if (addButton) {
          const title = await addButton.getAttribute("title");
          console.log(`Found button with title: ${title || "no title"}`);

          if (title === "Agrega los productos a la cubeta.") {
            // Find the quantity input in the second column
            const quantityInputs = await row.$$(
              'input[name^="cantidad_pedir_"]'
            );

            if (quantityInputs.length > 0) {
              // Set quantity to 1
              await quantityInputs[0].fill("1");
              await debugScreenshot("quantity-filled");

              // Click the "Add to cart" button/image
              await addButton.click();
              await debugScreenshot("added-to-cart");
              console.log("✅ Product added to cart!");

              foundStock = true;
            }
          } else {
            // Log what we found for debugging
            console.log(`Found button but title doesn't match: "${title}"`);
          }
        } else {
          console.log("No img found in the third column cell");
        }
      }
    }

    // Only navigate to cart if we found at least one item in stock
    if (foundStock) {
      // Wait for 5 seconds before clicking on the cart icon
      console.log("Waiting 5 seconds before navigating to cart...");
      await page.waitForTimeout(5000);

      // Click on the cart icon to navigate to the cart page
      console.log("Navigating to the cart page...");
      await page.click("a#cesta");
      await debugScreenshot("cart-page");
      console.log("✅ Navigated to cart page!");

      // Wait for the first modal with "aceptar" button to appear
      console.log("Waiting for the first modal...");
      await page.waitForSelector("button#aceptar", { timeout: 10000 });
      await debugScreenshot("first-modal");

      // Click the "aceptar" button
      console.log("Clicking 'aceptar' button in the first modal...");
      await page.click("button#aceptar");
      await debugScreenshot("after-first-modal");
      // Wait for 5 seconds after initiating order processing
      console.log("Waiting 5 seconds after initiating order processing...");
      await page.waitForTimeout(5000);
      // Wait for the second modal with "Procesar pedido" button to appear
      console.log("Waiting for the second modal...");
      await page.waitForSelector("button.aceptarDialogo", { timeout: 10000 });
      await debugScreenshot("second-modal");
      // Wait for 5 seconds after initiating order processing
      console.log("Waiting 5 seconds after initiating order processing...");
      await page.waitForTimeout(5000);
      // Click the "Procesar pedido" button
      console.log("Clicking 'Procesar pedido' button in the second modal...");
      await page.click("button.aceptarDialogo");
      await debugScreenshot("after-second-modal");
      // Wait for 5 seconds after initiating order processing
      console.log("Waiting 5 seconds after initiating order processing...");
      await page.waitForTimeout(5000);
      console.log("✅ Order processing initiated!");
    }

    if (!foundStock) {
      console.log(`❌ No stock available for ${PRODUCT_NAME} at this time.`);
    } else {
      console.log(`✅ Found ${PRODUCT_NAME} in stock and added to cart!`);
    }
  } catch (error) {
    console.error("An error occurred:", error);
    if (DEBUG_MODE) {
      // Take a screenshot of the error state
      try {
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/error-${Date.now()}.png`,
        });
        console.log(`Error screenshot saved to ${SCREENSHOTS_DIR}`);
      } catch (screenshotError) {
        console.error("Failed to take error screenshot:", screenshotError);
      }
    }
  } finally {
    // Close browser
    await browser.close();
    console.log("Finished checking stock.");
  }
}

// Run the function
checkProductStock();
