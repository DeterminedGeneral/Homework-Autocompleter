const curlRequesticator = require('../utils/curlRequesticator');

class Sparx_Requesticator extends curlRequesticator {
  constructor(authToken) {
    super(authToken);
    this.additionalHeaders = [];
    this.headers = [
        'accept: */*',
        'accept-language: en-GB,en;q=0.9,en-US;q=0.8',
        `authorization: ${authToken}`,
        'content-type: application/grpc-web+proto',
        'origin: https://maths.sparx-learning.com/',
        'priority: u=1, i',
        'referer: https://maths.sparx-learning.com/',
        'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144", "Microsoft Edge";v="144"',
        'sec-ch-ua-mobile: ?0',
        'sec-ch-ua-platform: "Windows"',
        'sec-fetch-dest: empty',
        'sec-fetch-mode: cors',
        'sec-fetch-site: same-site',
        'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',
        'x-grpc-web: 1',
        'x-server-offset: -2',
        'x-session-id: null'
    ];
  }

    async sendRequest(url, data) {
    const headers = [
        ...this.headers,
        ...this.additionalHeaders
    ];

    const body = Buffer.isBuffer(data) ? data : Buffer.from(data);

    return this._executeCurl(
        url,
        headers,
        body,
        { responseType: 'arraybuffer', returnHeaders: true }
    );
    }

}

module.exports = Sparx_Requesticator;