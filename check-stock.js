const { chromium } = require("playwright");
require("dotenv").config();
const axios = require("axios"); // Added for Telegram notifications

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

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ENABLE_TELEGRAM = process.env.ENABLE_TELEGRAM === "true";

// Function to send Telegram message
async function sendTelegramMessage(message) {
  if (!ENABLE_TELEGRAM || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("Telegram notifications not configured or disabled.");
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    });

    if (response.data.ok) {
      console.log("✅ Telegram notification sent successfully!");
    } else {
      console.error("Failed to send Telegram notification:", response.data);
    }
  } catch (error) {
    console.error("Error sending Telegram notification:", error.message);
  }
}

// Check if credentials are provided
if (!USERNAME || !PASSWORD) {
  console.error(
    "Error: Missing credentials. Please provide USERNAME and PASSWORD environment variables."
  );
  process.exit(1);
}

// Function to evaluate if a product has stock based on both visual indicators and button state
async function hasStock(row) {
  try {
    // Check if stock cell has "sinStock" class which indicates no stock
    const stockCell = await row.$("td.sinStock");
    if (stockCell) {
      const hasEscasoClass = await stockCell.evaluate((el) =>
        el.classList.contains("escaso")
      );
      console.log(
        `Stock status: ${hasEscasoClass ? "Escaso (limited)" : "No stock"}`
      );

      // Even if marked as "escaso", we should check if buttons are enabled
      const plusButton = await row.$("ion-icon.plus-btn:not(.disabled)");
      const addButton = await row.$("button.comprarapida:not(.disabled)");

      return plusButton !== null || addButton !== null;
    }

    // If no "sinStock" class is found, check for active buttons
    const plusButton = await row.$("ion-icon.plus-btn:not(.disabled)");
    const addButton = await row.$("button.comprarapida:not(.disabled)");

    return plusButton !== null || addButton !== null;
  } catch (error) {
    console.error("Error checking stock:", error);
    return false;
  }
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
    // Wait for the search input field to be visible and ready
    console.log("Waiting for search input to be available...");
    await page.waitForSelector("input#material", {
      state: "visible",
      timeout: 30000,
    });
    await debugScreenshot("search-input-available");
    console.log(`Searching for ${PRODUCT_NAME}...`);
    await page.fill("input#material", PRODUCT_NAME);

    // Click the "Buscador rápido" button instead of pressing Enter
    console.log("Clicking 'Buscador rápido' button...");
    await page.waitForSelector("button#rapido", { timeout: 10000 });
    await page.click("button#rapido");
    await debugScreenshot("search-entered");

    // Wait for results table to load
    console.log("Waiting for search results...");
    await page.waitForSelector("table#listado_limitados", { timeout: 30000 });
    await debugScreenshot("search-results");

    // Adding a delay to ensure the table fully loads
    console.log(
      `Waiting for an additional ${TABLE_LOAD_DELAY}ms to ensure table fully loads...`
    );
    await page.waitForTimeout(TABLE_LOAD_DELAY);

    // Check if any product is available
    const rows = await page.$$("table#listado_limitados tbody tr");
    console.log(`Found ${rows.length} results in the table.`);

    let foundStock = false;

    // Process each row
    for (const row of rows) {
      try {
        // Get product name and details from the row for better logging
        const productNameCell = await row.$("td:nth-child(4)");
        const productName = productNameCell
          ? await productNameCell.textContent()
          : "Unknown product";
        const codeNationalCell = await row.$("td:nth-child(3)");
        const codeNational = codeNationalCell
          ? await codeNationalCell
              .textContent()
              .then((text) => text.trim().split("\n")[0])
          : "Unknown";

        console.log(`Checking product: ${productName} (CN: ${codeNational})`);

        // Check if product has stock using our helper function
        const productHasStock = await hasStock(row);

        if (productHasStock) {
          console.log(`✅ Found product with available stock: ${productName}`);

          // Find the quantity input
          const quantityInput = await row.$("input[type='number']");

          if (quantityInput) {
            // Check if input is disabled
            const isInputDisabled = await quantityInput.evaluate(
              (el) => el.disabled
            );
            if (isInputDisabled) {
              console.log("Quantity input is disabled, cannot add to cart");
              continue;
            }

            // Set quantity to 1
            await quantityInput.fill("1");
            await debugScreenshot(`quantity-filled-${codeNational}`);

            // Try to click the "Añadir" button up to 3 times
            const addButton = await row.$("button:text('Añadir')");
            if (addButton) {
              const isAddButtonDisabled = await addButton.evaluate(
                (el) => el.disabled
              );

              if (!isAddButtonDisabled) {
                let addSuccess = false;
                // Try up to 3 times to add the product to the cart
                for (let attempt = 1; attempt <= 3; attempt++) {
                  try {
                    console.log(
                      `Attempt ${attempt} to add ${productName} to cart...`
                    );
                    await addButton.click();
                    await debugScreenshot(
                      `added-to-cart-attempt-${attempt}-${codeNational}`
                    );

                    // Wait a moment for the cart to update
                    await page.waitForTimeout(1000);

                    console.log(
                      `✅ Product ${productName} (${codeNational}) added to cart on attempt ${attempt}!`
                    );
                    addSuccess = true;
                    foundStock = true;
                    break;
                  } catch (addError) {
                    console.error(
                      `Error on attempt ${attempt} adding to cart:`,
                      addError.message
                    );
                    if (attempt < 3) {
                      console.log(`Waiting 2 seconds before next attempt...`);
                      await page.waitForTimeout(2000);
                    }
                  }
                }

                if (!addSuccess) {
                  console.log(
                    `❌ Failed to add ${productName} to cart after 3 attempts`
                  );
                }
                continue;
              } else {
                console.log(`"Añadir" button is disabled for ${productName}`);
              }
            } else {
              console.log(`Could not find "Añadir" button for ${productName}`);
            }

            console.log(
              "Button is disabled or not found despite stock indicator showing availability"
            );
          } else {
            console.log("Could not find quantity input");
          }
        } else {
          console.log(
            `No stock available for: ${productName} (${codeNational})`
          );
        }
      } catch (rowError) {
        console.error("Error processing row:", rowError);
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
      await sendTelegramMessage(
        `❌ No stock available for <b>${PRODUCT_NAME}</b> at this time.`
      );
    } else {
      console.log(`✅ Found ${PRODUCT_NAME} in stock and added to cart!`);
      await sendTelegramMessage(
        `🎉 <b>STOCK FOUND!</b> 🎉\n\n✅ Found <b>${PRODUCT_NAME}</b> in stock and added to cart!\n\nCheck your Hefame account to complete the order.`
      );
    }
  } catch (error) {
    console.error("An error occurred:", error);
    await sendTelegramMessage(
      `⚠️ <b>ERROR:</b> An error occurred while checking stock for <b>${PRODUCT_NAME}</b>: ${error.message}`
    );
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
