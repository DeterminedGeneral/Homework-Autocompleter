require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
puppeteer.use(StealthPlugin());
const smartLogin = require('../utils/smartLogin');

async function senecaLogin(username, password, type, on2FA) {
  const browser = await puppeteer.launch({ headless: true });
  let authToken = null;

  try {
    const page = await browser.newPage();

    // --- Attach request listener early ---
    const accessKeyPromise = new Promise(resolve => {
      function onRequest(req) {
        const headers = req.headers();
        if (headers['access-key']) {
          authToken = headers['access-key'];
          page.off('request', onRequest); // stop after first match
          resolve(authToken);
        }
      }
      page.on('request', onRequest);
    });

    // --- Go to Seneca login ---
    await page.goto('https://app.senecalearning.com/login', { waitUntil: 'networkidle0', timeout: 50000 });

    const popupPromise = new Promise(resolve => {
      browser.once('targetcreated', async target => {
        const newPage = await target.page();
        if (newPage) resolve(newPage);
      });
    });

    const allButtons = await page.$$('button');
    const continueButtons = [];

    for (const btn of allButtons) {
      const text = await page.evaluate(el => el.innerText, btn);
      if (text.toLowerCase().includes('continue')) {
        continueButtons.push(btn);
      }
    }

    const landedFunction = ({ page }) => page.isClosed();

    if (type === 'Microsoft') {
      // Start popup listener BEFORE clicking

      await continueButtons[1].click();
      console.log("Clicked Microsoft login button");

      const popup = await popupPromise;
      await popup.bringToFront();

      await smartLogin(popup, username, password, 'Microsoft', landedFunction, () => {}, on2FA);

    } else if (type === 'Google') {
      await continueButtons[0].click();
      console.log("Clicked Google login button");

      const popup = await popupPromise;
      await popup.bringToFront();

      await smartLogin(popup, username, password, 'Google', landedFunction, () => {}, on2FA);

    } else {
      await continueButtons[2].click();
      console.log("Clicked Normal login button");
      await page.waitForSelector('#email', { visible: true });
      await page.type('#email', username);
      await page.type('#password', password);

      const buttons = await page.$$('button');

      for (const btn of buttons) {
        const text = await page.evaluate(el => el.innerText.trim(), btn);
        if (text === 'Log in' || text === 'Send one-time email link') {
          await btn.click();
          break;
        }
      }
    }

    // --- Wait until either access-key is found OR network idle ---
    await Promise.race([
      accessKeyPromise,
      delay(10000)// wait up to 10s for idle
    ]);

    return authToken;

  } catch (err) {
    console.error("seneca login error:", err);
    return false;
  } finally {
    await browser.close();
  }
}

module.exports = { senecaLogin };