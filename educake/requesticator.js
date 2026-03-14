const curlRequesticator = require('../utils/curlRequesticator');

/**
 * Educake Implementation
 */
class Educake_Requesticator extends curlRequesticator {
  constructor(cookies, login = {}) {
    super(cookies);
    this.login = login;
    this.sessionToken = null;
  }

  async sendRequest(url, data) {
    const headers = [
      'accept: application/json;version=2',
      'accept-language: en-GB,en;q=0.9,en-US;q=0.8',
      'content-type: application/json',
      'origin: https://my.educake.co.uk',
      'referer: https://my.educake.co.uk/my-educake/quiz/173004071',
      'sec-ch-ua: "Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
      'sec-ch-ua-mobile: ?0',
      'sec-ch-ua-platform: "Windows"',
      'sec-fetch-dest: empty',
      'sec-fetch-mode: cors',
      'sec-fetch-site: same-origin',
      'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
    ];

    if (this.sessionToken) {
      headers.push(`authorization: Bearer ${this.sessionToken}`);
    }

    return this._executeCurl(url, headers, data);
  }
}

module.exports = Educake_Requesticator;