const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- Configuration ---
const DEFAULT_TIMEOUT = 2000;

async function isElementVisible(page, selector) {
    try {
        const el = await page.$(selector);
        if (!el) return false;
        const box = await el.boundingBox();
        return box !== null;
    } catch { return false; }
}

async function smartLogin(page, email, password, loginType = 'Normal', landedFunction, logFn = () => { }, on2FA) {
    const log = (msg) => logFn(`[SmartLogin][${loginType}] ${msg}`);

    page.setDefaultTimeout(DEFAULT_TIMEOUT);

    const EMAIL_SELECTORS = ['input[name="loginfmt"]', 'input[type="email"]', 'input[name="identifier"]', '#i0116', '#Email'].join(',');
    const PASSWORD_SELECTORS = ['input[name="passwd"]', 'input[name="Passwd"]', 'input[type="password"]', '#i0118'].join(',');
    const TWO_FACTOR_SELECTORS = ['input[name="otc"]', '#idTxtBx_SAOTCC_OTC', 'input[name="code"]', '#idTxtBx_SMSOTP_OTC'].join(',');
    const AUTHENTICATOR_DISPLAY_SELECTORS = ['#idRichContext_DisplaySign', '.displaySign'].join(',');
    const ANOTHER_WAY_LINK = '#signInAnotherWay';
    const OPTION_List = 'div[data-bind*="options"] .table, #idDiv_SAOTCS_Proofs .table';
    const SUBMIT_BUTTONS = [
        '#idSIButton9', '#identifierNext', '#passwordNext', '#submit',
        'button[type="submit"]', 'button[id*="Next"]',
        '#identity-provider-linking-continue',
        'span ::-p-text("Continue")'
    ].join(',');

    const ERROR_INDICATORS = ['#usernameError', '#passwordError', 'div[aria-live="assertive"]', '.error', '.text-danger'].join(',');

    let filledEmail = false;
    let filledPassword = false;
    let lastUrl = page.url();
    let last2FANumber = null;
    let lastAuthType = null;
    let isWaitingForUser = false;
    let userDecisionPromise = null;

    const ALL_INTERACTIVE = `${EMAIL_SELECTORS},${PASSWORD_SELECTORS},${SUBMIT_BUTTONS}`;

    for (let attempt = 0; attempt < 25; attempt++) {
        const url = page.url();

        // 1. Success Check
        if (landedFunction({ url, page })) return { filledEmail, filledPassword };

        // 2. Navigation State Reset
        if (url !== lastUrl) {
            log(`Navigated: ${url.substring(0, 40)}...`);
            lastUrl = url;
            filledPassword = false;
        }

        try { await page.waitForSelector(ALL_INTERACTIVE, { visible: true, timeout: 500 }); } catch { }

        // 4. Speedbump Handling
        if (url.includes('samlconfirmaccount') || url.includes('speedbump')) {
            log(`Speedbump page detected.`);
            try {
                const continueBtn = await page.$('#identity-provider-linking-continue, span ::-p-text("Continue")');
                if (continueBtn) {
                    await continueBtn.click();
                    await page.waitForNetworkIdle({ timeout: 1000, idleTime: 100 }).catch(() => { });
                    continue;
                }
            } catch { }
        }

        // 5. Error Detection (FIXED LOGIC)
        if (await isElementVisible(page, ERROR_INDICATORS)) {
            // FIX: Check PASSWORD selectors first. 
            // If the password field is visible, any error on screen is likely a password error.
            // We only check this if we believe we have already filled the email (filledEmail == true).
            if (filledEmail && await isElementVisible(page, PASSWORD_SELECTORS)) {
                log(`Password Error. Retrying...`);
                filledPassword = false;
            }
            // Only if Password field is NOT visible do we assume it's an email error.
            else if (await isElementVisible(page, EMAIL_SELECTORS)) {
                // Double check: Is the email field actually empty or wrong?
                // Sometimes error text persists even if the email is correct.
                try {
                    const currentVal = await page.$eval(EMAIL_SELECTORS, el => el.value);
                    if (currentVal !== email) {
                        log(`Email Error (Field mismatch). Retrying...`);
                        filledEmail = false;
                    }
                } catch {
                    // If we can't read the value, assume error logic is correct
                    log(`Email Error. Retrying...`);
                    filledEmail = false;
                }
            }
        }

        // --- Explicit State Check ---
        if (filledPassword) {
            try {
                const passVal = await page.$eval(PASSWORD_SELECTORS, el => el.value).catch(() => 'unknown');
                if (passVal === '') {
                    log('Password field detected empty. Retrying typing...');
                    filledPassword = false;
                }
            } catch { }
        }

        // 6. Handle 2FA Prompt
        if (on2FA) {
            let authType = null;
            let value = null;
            let methods = [];

            if (await isElementVisible(page, AUTHENTICATOR_DISPLAY_SELECTORS)) {
                authType = 'approval';
                try {
                    const numberEl = await page.$(AUTHENTICATOR_DISPLAY_SELECTORS);
                    value = await page.evaluate(el => el.innerText.trim(), numberEl);
                    if (value !== last2FANumber) {
                        last2FANumber = value;
                        isWaitingForUser = false;
                    }
                } catch (e) { log(`Error processing Authenticator number: ${e.message}`); }
            } else if (await isElementVisible(page, TWO_FACTOR_SELECTORS)) {
                authType = 'code';
            } else if (await isElementVisible(page, OPTION_List)) {
                authType = 'select_method';
                try {
                    methods = await page.$$eval('.table-row', rows => rows.map((r, i) => ({
                        text: r.innerText.split('\n')[0].trim(),
                        value: r.querySelector('div[data-value]')?.getAttribute('data-value'),
                        index: i
                    })));
                } catch (e) { log(`Error extracting methods: ${e.message}`); }
            }

            if (authType) {
                if (isWaitingForUser && (lastAuthType !== authType || (authType === 'approval' && value !== last2FANumber))) {
                    isWaitingForUser = false;
                    userDecisionPromise = null;
                }

                if (!isWaitingForUser) {
                    isWaitingForUser = true;
                    lastAuthType = authType;
                    last2FANumber = value;

                    userDecisionPromise = on2FA({
                        type: authType,
                        value: value,
                        methods: methods
                    });
                }

                const result = await Promise.race([
                    userDecisionPromise,
                    new Promise(r => setTimeout(() => r(null), 2000))
                ]);

                if (result) {
                    isWaitingForUser = false;
                    userDecisionPromise = null;

                    if (result.action === 'select_method') {
                        log(`User selected method index: ${result.index}`);
                        await page.evaluate((idx) => {
                            const rows = document.querySelectorAll('.table-row');
                            if (rows[idx]) rows[idx].click();
                        }, result.index);
                        await new Promise(r => setTimeout(r, 1000));
                        continue;
                    } else if (result.action === 'code') {
                        log('User entered code.');
                        const input = await page.$(TWO_FACTOR_SELECTORS);
                        if (input) {
                            await input.click({ clickCount: 3 });
                            await input.press('Backspace');
                            await input.type(result.code, { delay: 100 });
                            await page.keyboard.press('Enter');
                        }
                        continue;
                    }
                } else {
                    continue;
                }
            } else {
                isWaitingForUser = false;
                userDecisionPromise = null;
            }
        }

        // 7. Handle Email
        if (!filledEmail) {
            try {
                const emailEl = await page.$(EMAIL_SELECTORS);
                if (emailEl && await isElementVisible(page, EMAIL_SELECTORS)) {
                    const currentVal = await page.$eval(EMAIL_SELECTORS, el => el.value);
                    if (currentVal !== email) {
                        log(`Typing Email...`);
                        await emailEl.click({ clickCount: 3 });
                        await emailEl.type(email, { delay: 15 });
                        filledEmail = true;
                        await page.keyboard.press('Enter');
                        continue;
                    } else {
                        // If the value is already correct, just mark it as filled
                        filledEmail = true;
                    }
                }
            } catch { }
        }

        // 8. Handle Password
        if (filledEmail && !filledPassword) {
            try {
                const passEl = await page.$(PASSWORD_SELECTORS);
                if (passEl && await isElementVisible(page, PASSWORD_SELECTORS)) {
                    log(`Typing Password...`);
                    await new Promise(r => setTimeout(r, 300));
                    await passEl.focus();

                    // Clear field just in case
                    await passEl.click({ clickCount: 3 });
                    await page.keyboard.press('Backspace');

                    await passEl.type(password, { delay: 20 });

                    filledPassword = true;
                    await page.keyboard.press('Enter');
                    continue;
                }
            } catch { }
        }

        // 9. Click Next/Submit
        try {
            const buttons = await page.$$(SUBMIT_BUTTONS);
            for (const btn of buttons) {
                if (await btn.isVisible()) {
                    // Prevention 1: Don't click Next if Email is visible but empty/wrong
                    if (!filledEmail && await isElementVisible(page, EMAIL_SELECTORS)) continue;

                    // Prevention 2: Don't click "Sign In" if password visible but not typed
                    if (await isElementVisible(page, PASSWORD_SELECTORS) && !filledPassword) {
                        continue;
                    }

                    log(`Clicking Next/Continue...`);
                    await btn.click();
                    await new Promise(r => setTimeout(r, 500));
                    break;
                }
            }
        } catch { }
    }

    return { filledEmail, filledPassword };
}

module.exports = smartLogin;