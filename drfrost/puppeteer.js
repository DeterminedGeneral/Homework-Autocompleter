require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const smartLogin = require('../utils/smartLogin');

puppeteer.use(StealthPlugin());

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Click a button by visible text
 * Tries Puppeteer click first, then falls back to evaluate click
 */async function clickButtonByText(page, text) {
  // 1. Wait slightly for overlays/animations to vanish
  await delay(1000);

  // 2. Find the element
  const found = await page.evaluateHandle((text) => {
    const buttons = [...document.querySelectorAll('button')];
    return buttons.find(b => {
      // Check text matches
      const hasText = b.innerText.toLowerCase().includes(text.toLowerCase());
      // Check if button is actually interactable (not disabled)
      const isEnabled = !b.disabled && !b.classList.contains('disabled');
      return hasText && isEnabled;
    });
  }, text);

  // 3. Handle the click
  if (found.asElement()) {
    const element = found.asElement();

    // Scroll into view to ensure standard click works
    await element.hover();

    try {
      // Attempt standard puppeteer click (triggers mouse events)
      await element.click({ delay: 100 });
      return true;
    } catch {
      // Fallback: If blocked by overlay, force a JS click
      console.log(`Standard click failed for "${text}", forcing JS click.`);
      await page.evaluate(el => el.click(), element);
      return true;
    }
  }

  return false;
}

async function drfrostLogin(username, password, type, on2FA) {
  const browser = await puppeteer.launch({ headless: true });
  let authToken = null;

  try {
    const page = await browser.newPage();

    const accessKeyPromise = new Promise(resolve => {
      function onRequest(req) {
        const headers = req.headers();
        if (headers['cookie'] && headers['cookie'].includes('_df_session=')) {
          authToken = headers['cookie'];
          page.off('request', onRequest); // stop after first match
          resolve(authToken);
        }
      }
      page.on('request', onRequest);
    });

    // --- Go to login page ---
    await page.goto('https://www.drfrost.org/login', {
      waitUntil: 'networkidle0'
    });

    // --- Accept cookies ---
    await clickButtonByText(page, 'accept optional cookies');

    const landedFunction = ({ url }) => url === 'https://www.drfrost.org/dashboard';

    if (type === 'Microsoft') {
      const clicked = await clickButtonByText(page, 'microsoft');
      if (!clicked) throw new Error('Microsoft login button not found');

      console.log('Clicked Microsoft login button');
      await smartLogin(page, username, password, 'Microsoft', landedFunction, () => {}, on2FA);

    } else if (type === 'Google') {
      const clicked = await clickButtonByText(page, 'google');
      if (!clicked) throw new Error('Google login button not found');
      console.log(clicked);

      console.log('Clicked Google login button');
      await smartLogin(page, username, password, 'Google', landedFunction, () => {}, on2FA);

    } else {
      console.log('Using normal login');


      await page.waitForSelector('input[name="username"]', { visible: true });
      await page.type('input[name="username"]', username);
      await page.type('input[name="password"]', password);

      await clickButtonByText(page, 'login');
    }

    await Promise.race([
      accessKeyPromise,
      delay(10000)// wait up to 10s for idle
    ]);

    return authToken;

  } catch (err) {
    console.error('drfrost login error:', err);
    return false;
  } finally {
    await browser.close();
  }
}

module.exports = { drfrostLogin };