const puppeteer = require('puppeteer-extra');
// const { req } = require('curl-cffi');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
require('dotenv').config();
const { execSync } = require('child_process');
const smartLogin = require('../utils/smartLogin');
const curlRequesticator = require('../utils/curlRequesticator');

puppeteer.use(StealthPlugin());
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- Token request ---
async function getTokenRequest(cookies, attempts = 3) {
  try {
    const requesticator = new curlRequesticator(cookies);
    const headers = [
      "accept: */*",
      "accept-language: en-GB,en;q=0.9",
      "content-type: application/json",
      "Referer: https://app.sparx-learning.com/"
    ];

    const response = await requesticator._executeCurl(
      "https://api.sparx-learning.com/token",
      headers
    );

    return typeof response === 'string' ? response.trim() : JSON.stringify(response);

  } catch {
    if (attempts > 0) {
      await delay(1500); // Reduced from 2000
      return getTokenRequest(cookies, attempts - 1);
    }
    return null;
  }
}

// --- Video Converter ---
async function convertWebmToMp4(vid_path) {
  try {
    const mp4Path = vid_path.replace('.webm', '.mp4');
    await execAsync(`ffmpeg -i "${vid_path}" -c:v libx264 -preset ultrafast -movflags faststart "${mp4Path}"`);
    fs.unlinkSync(vid_path);
    return mp4Path;
  } catch (err) {
    console.log('Video conversion failed:', err.message);
    return vid_path;
  }
}

// --- Fast safe click ---
async function safeClick(page, selector, maxAttempts = 2) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Try direct click first (fastest)
      const el = await page.$(selector);
      if (el) {
        const isVisible = await el.isIntersectingViewport();
        if (isVisible) {
          await el.click();
          return true;
        }
      }

      // Fallback to evaluate click
      const clicked = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) {
          el.click();
          return true;
        }
        return false;
      }, selector);

      if (clicked) return true;
    } catch { }

    if (attempt < maxAttempts - 1) await delay(100); // Reduced from 300
  }
  throw new Error(`Failed to click ${selector}`);
}

async function clickButtonWithText(page, text, timeout = 10000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const clicked = await page.evaluate((text) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.trim().includes(text));
        if (btn && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
        return false;
      }, text);

      if (clicked) return;
    } catch { }

    await delay(100); // Reduced from 200
  }

  throw new Error(`Button with text "${text}" not found`);
}

async function getCookies(school, email, password, loginType, app, on2FA) {
  // Aggregate attempt logs and emit a single summary if the whole run fails
  const addLog = (msg) => console.log(msg);
  for (let attempt = 1; attempt <= 1; attempt++) {
    addLog(`Attempt ${attempt} started: school='${school}', app='${app}', loginType='${loginType}'`);
    try {
      execSync('rm -rf /tmp/puppeteer_*', { stdio: 'ignore' });
      console.log('Cleared Puppeteer cache and temp data.');
      addLog('Cache cleared.');
    } catch (err) {
      console.warn('Failed to clear Puppeteer cache:', err.message);
      addLog(`Cache clear failed: ${err.message}`);
    }
    let schoolStatus = false;
    let loginTypeStatus = false;
    let emailTypeStatus = false;
    let passTypeStatus = false;

    let smartLoginVar = { filledEmail: false, filledPassword: false };

    let browser;
    let page;
    let recorder = null;
    let vid_path = `videos/recording-${Date.now()}.webm`;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--start-maximized',
          '--no-first-run',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--ignore-certificate-errors',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--ignore-certificate-errors-spki-list'
        ]
      });

      page = await browser.newPage();
      addLog('Browser launched and new page created.');

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {} };
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        Object.defineProperty(navigator, 'platform', {
          get: () => 'Win32'
        });
      });
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.3537.71',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0'
      ];
      await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
      addLog('User agent set.');

      // Set up screencast if available
      if (page.screencast) {
        recorder = await page.screencast({ path: vid_path }).catch(() => null);
        if (recorder) addLog(`Screencast started -> ${vid_path}`);
      } else {
        addLog('Screencast API not available.');
      }

      await page.goto(`https://selectschool.sparx-learning.com/?app=sparx_${app}`, {
        waitUntil: 'domcontentloaded',
        timeout: 3000
      });
      addLog('Navigated to select school page.');

      // Remove cookie popup immediately
      await page.evaluate(() => {
        const el = document.getElementById('cookiescript_injected_wrapper');
        if (el) el.remove();
      }).catch(() => { });
      addLog('Cookie popup removed (if present).');

      await page.waitForSelector('._Input_1573n_4', { timeout: 3000, visible: true });

      // Check if school input is blank and fill it
      const schoolInputValue = await page.$eval('._Input_1573n_4', el => el.value);
      if (!schoolInputValue || schoolInputValue.trim() === '') {
        await page.type('._Input_1573n_4', school, { delay: 0 }); // Faster typing
        addLog('Typed school name.');
      } else {
        addLog('School name already filled, skipping.');
      }

      await page.waitForSelector('._SchoolResult_1h7n6_1', { timeout: 3000, visible: true });
      // Removed redundant delay(300)
      await safeClick(page, '._SchoolResult_1h7n6_1');
      addLog('Selected school result.');

      schoolStatus = true;

      // Removed redundant delay(500) - clickButtonWithText handles waiting
      await clickButtonWithText(page, 'Continue', 3000);
      addLog('Clicked Continue.');

      // Fast wait for navigation
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 3000 }),
        delay(2000)
      ]).catch(() => { });
      addLog('Waited for post-continue navigation.');

      // Removed redundant delay(500) stabilization

      try {
        await page.waitForSelector('#cookiescript_injected_wrapper', { timeout: 3000 });
        await page.evaluate(() => {
          const el = document.getElementById('cookiescript_injected_wrapper');
          if (el) el.remove();
        });
      } catch {
      }
      addLog('Cookie popup removed again (if present).');

      // Handle SSO login if needed
      if (loginType.toLowerCase() !== 'normal') {
        // Removed redundant delay(300)
        await safeClick(page, '.sm-button.sso-login-button');
        addLog('Clicked SSO login button.');
        loginTypeStatus = true;

        // Fast wait for SSO redirect
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
          delay(1500)
        ]).catch(() => { });
        addLog('Waited for SSO redirect.');

        // Removed redundant delay(300)
        const landedFunction = ({ url }) =>
          ['science', 'reader', 'maths', 'app']
            .some(sub => url.includes(sub + '.sparx-learning.com'));
        smartLoginVar = await smartLogin(page, email, password, loginType, landedFunction, addLog, on2FA);
        addLog(`smartLogin finished: emailFilled=${smartLoginVar.filledEmail}, passFilled=${smartLoginVar.filledPassword}`);
      } else {
        const inputs = await page.$$('.sm-input');
        if (inputs.length >= 2) {
          // Check and fill email if blank
          const emailValue = await inputs[0].evaluate(el => el.value);
          if (!emailValue || emailValue.trim() === '') {
            await inputs[0].click({ clickCount: 3 });
            await inputs[0].press('Backspace');
            await inputs[0].type(email, { delay: 0 }); // Faster typing
            emailTypeStatus = true;
            addLog('Typed email in normal login.');
          } else {
            emailTypeStatus = true;
            addLog('Email already filled in normal login.');
          }

          // Check and fill password if blank
          const passValue = await inputs[1].evaluate(el => el.value);
          if (!passValue || passValue.trim() === '') {
            await inputs[1].click({ clickCount: 3 });
            await inputs[1].press('Backspace');
            await inputs[1].type(password, { delay: 0 }); // Faster typing
            passTypeStatus = true;
            addLog('Typed password in normal login.');
          } else {
            passTypeStatus = true;
            addLog('Password already filled in normal login.');
          }
        } else {
          throw new Error('Normal login inputs not found.');
        }

        emailTypeStatus = true;
        passTypeStatus = true;
        // Click login
        await safeClick(page, '.sm-button.login-button');
        addLog('Clicked login button (normal login).');
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
          delay(1500)
        ]).catch(() => { });
        addLog('Waited for post-login navigation (normal login).');
      }
      // Quick cookie check
      await delay(1500);

      const cookies = await page.cookies();
      const live = cookies.find(c => c.name === 'live_ssoprovider_session');
      const spx = cookies.find(c => c.name === 'spxlrn_session');
      addLog(`Cookie check (pre-final): live=${!!live}, spxlrn=${!!spx}`);

      const finalCookies = await page.cookies();
      const live2 = finalCookies.find(c => c.name === 'live_ssoprovider_session');
      const spx2 = finalCookies.find(c => c.name === 'spxlrn_session');
      const cookieString = `live_ssoprovider_session=${(live2?.value ?? live?.value) || ''}; spxlrn_session=${(spx2?.value ?? spx?.value) || ''}`;
      addLog(`Cookie check (final): live=${!!live2 || !!live}, spxlrn=${!!spx2 || !!spx}`);
      addLog(cookieString);
      if (cookieString.length <= 42) {
        throw new Error("Login failed - no valid cookies found");
      }

      if (recorder) await recorder.stop();
      await browser.close();

      if (fs.existsSync(vid_path)) {
        convertWebmToMp4(vid_path).catch(console.error);
      }
      addLog('Login successful, cookies validated.');

      return cookieString;

    } catch (err) {
      const attemptMsg = `Attempt ${attempt} failed: ${err.message}`;
      console.log(attemptMsg);
      addLog(attemptMsg);

      if (recorder) await recorder.stop().catch(() => { });
      if (browser) await browser.close().catch(() => { });

      if (fs.existsSync(vid_path)) {
        vid_path = await convertWebmToMp4(vid_path);
      }
      emailTypeStatus = smartLoginVar.filledEmail;
      passTypeStatus = smartLoginVar.filledPassword;
      if (attempt === 1) {
        return {
          status: 'error',
          schoolStatus,
          loginTypeStatus,
          emailTypeStatus,
          passTypeStatus,
          vid_path
        };
      }

    } finally {
      if (browser && browser.isConnected()) await browser.close().catch(() => { });
    }
  }
}

// --- Exported ---
async function getTokenSparx(school, email, password, loginType, app, on2FA) {
  const cookiesString = await getCookies(school, email, password, loginType, app, on2FA);
  if (!cookiesString || cookiesString?.status === 'error') return cookiesString;
  const token = await getTokenRequest(cookiesString);
  console.log(token);
  return { token, cookies: cookiesString };
}

module.exports = { getTokenSparx, getTokenRequest };