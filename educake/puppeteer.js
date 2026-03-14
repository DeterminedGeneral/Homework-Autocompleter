require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
puppeteer.use(StealthPlugin());
const smartLogin = require('../utils/smartLogin'); // my-educake

async function educakeLogin(username, password, loginType, on2FA) {
  // Launch browser
  const browser = await puppeteer.launch({ headless: true });
  try {
  const page = await browser.newPage();

  // Go to a website
  await page.goto('https://my.educake.co.uk/student-login', { waitUntil: 'networkidle0', timeout: 5000});

  const cookieButtonSelector = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll';
  const cookieButton = await page.$(cookieButtonSelector);
  if (cookieButton) {
    await cookieButton.click();
    console.log('Cookie consent accepted!');
  }

  if (loginType === 'Normal') {
    // Wait until the username input appears
    await page.waitForSelector('input[name="username"]', { visible: true });

    // Type into the username field
    await page.type('input[name="username"]', username);

    await page.waitForSelector('input[name="password"]', { visible: true });

    await page.type('input[name="password"]', password);

    // Wait for the cookie consent button to appear

    const loginButtonSelector = 'button[type="submit"]';
    await page.waitForSelector(loginButtonSelector, { visible: true });
    // Click the button
    await page.click(loginButtonSelector);

    await page.evaluate(selector => {
      const btn = document.querySelector(selector);
      if (btn) btn.click();
    }, loginButtonSelector);

    // Optional: wait for navigation or successful login indicator
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
  } else {
    await page.evaluate((index) => {
      document.querySelectorAll('.sso-login.btn.white')[index].click();
    }, loginType === 'Google' ? 0 : 1);

    const landedFunction = ({url}) => url.includes('my.educake.co.uk/my-educake');
    await smartLogin(page, username, password, loginType, landedFunction, () => {}, on2FA);
  }
  console.log('Login complete!');
  await delay(3000);

  // Take a screenshot
  // await page.screenshot({ path: 'example.png' });
  const cookiesArray = await page.cookies();

  const desiredOrder = ['PHPSESSID', 'cf_clearance', 'XSRF-TOKEN', '_dd_s'];

  // Map cookies by name to their "NAME=VALUE"
  const cookiesMap = new Map(cookiesArray.map(c => [c.name, `${c.name}=${c.value}`]));

  // Build ordered array of cookies (skipping any missing)
  const orderedCookies = desiredOrder.map(name => cookiesMap.get(name)).filter(Boolean);

  // Join into single cookie header string
  const cookieHeader = orderedCookies.join('; ');

  return cookieHeader;
  } catch(err) {
    console.log("Educake login error");
    console.log(err);
    return false;
  } finally {
    await browser.close();
  }

}

module.exports = { educakeLogin };