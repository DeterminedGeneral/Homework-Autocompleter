const curlRequesticator = require('../utils/curlRequesticator');

/**
 * DrFrost Implementation
 */
class DrFrost_Requesticator extends curlRequesticator {
  async sendRequest(url, data) {
    const headers = [
      'accept: application/json, text/javascript, */*; q=0.01',
      'accept-language: en-GB,en;q=0.9',
      'baggage: sentry-environment=production,sentry-release=fcff37234e83f003cc7f58fbf31695e3f31d7f80,sentry-public_key=e9a7cb90d7fe84969ed38bfd9a243f56,sentry-trace_id=4c8ab7b730c64bf0b8243c11d30a3c93',
      // DrFrost specifically uses text/plain for JSON payloads in your specific case
      'content-type: text/plain;charset=UTF-8', 
      'origin: https://www.drfrost.org',
      'priority: u=1, i',
      'referer: https://www.drfrost.org/progress.php?mode=tasklist',
      'sec-ch-ua: "Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-mobile: ?0',
      'sec-ch-ua-platform: "Windows"',
      'sec-fetch-dest: empty',
      'sec-fetch-mode: cors',
      'sec-fetch-site: same-origin',
      'sentry-trace: 4c8ab7b730c64bf0b8243c11d30a3c93-b55a72e9c757ba9b',
      'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
      'x-requested-with: XMLHttpRequest'
    ];

    return this._executeCurl(url, headers, data);
  }
}


module.exports = DrFrost_Requesticator;