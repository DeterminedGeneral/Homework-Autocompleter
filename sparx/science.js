const { decode, encode } = require('./ss_code.js');
const { getTokenSparx, getTokenRequest } = require('./puppeteer.js');
const Educake_Requesticator = require('../educake/requesticator.js');
const SparxBase = require('./sparxBase.js');

class SparxScience extends SparxBase {
    constructor(authToken, login={}, cookies) {
        super(authToken, login, cookies, decode, encode);
    }

    async getClientID() {
        const curlRequests = new Educake_Requesticator();
        const htmlContent = await curlRequests.sendRequest('https://science.sparx-learning.com/packages');
        const regex = /science\/([a-z0-9]{40})\//;

        const match = htmlContent.match(regex);

        if (match) {
            const id = match[1]; // match[1] contains the captured ID
            console.log(id);
            this.clientID = id;
            this.curlRequests.additionalHeaders = [`spx-app-version: ${id} (2026-02-11T12:49:29Z) science`];
            return id;
            // Output: 042c97dc13fc71e51bb9b07e3b79df08732c90bc
        } else {
            console.log("ID not found");
            return null;
        }
    }

    async send(url, Uint8Array, attempts=3) {

        try {

        this.log.logToFile(`Sending request to ${url}`);
        const response = await this.curlRequests.sendRequest(url, Uint8Array);
        this.log.logToFile(`**Response returned**\nStatus: ${response.status}\n${JSON.stringify(response.headers, null, 2)}`);
        if (response.status == 401) {
            const err = new Error("Unauthorized");
            err.response = { status: 401 };
            throw err;
        }

        // console.log('Status:', response.status);

        if (response.headers['grpc-status'] === '16') { // grpc-message: PendingWAC
            const error = new Error(response.headers);
            error.response = { status: 401 };
            throw error;
        }

        if (response.headers['grpc-status'] === '9' && response.headers['grpc-message'] === 'wrong question state for answer action') {
            return 9;
        }

        if (response.headers['grpc-status'] === '8') {
            return 8;
        }

        // const hex = Buffer.from(response.data).toString('hex');
        // console.log(`Raw Response (Hex): ${hex}`);

        return response;

        } catch(err) {
            await new Promise(res => setTimeout(res, 5000));
            this.log.logToFile(err);
            if (err.response?.status === 401 && attempts > 1) {
                this.log.logToFile("Caught 401 Unauthorized, handling it attempting relogin...");

                let newAuthToken;
                if (this.login?.school) {
                    const newAuthTokenN = await getTokenSparx(this.login.school, this.login.email, this.login.password, this.login.loginType, this.login.app);
                    if (newAuthTokenN?.cookies) {
                        this.cookies = newAuthTokenN.cookies;
                    }
                    if (newAuthTokenN?.token && !(newAuthTokenN?.token.includes("Unauthorized"))) {
                        newAuthToken = newAuthTokenN.token;
                    }
                } else {
                    newAuthToken = await getTokenRequest(this.cookies);
                    if (newAuthToken.includes('Unauthorized')) {
                        throw new Error(err);
                    }
                }

                if (newAuthToken) {
                    this.log.logToFile("The new authtoken has been successfully acquired!");
                    this.authToken = newAuthToken;
                    this.curlRequests.headers[2] = `authorization: ${this.authToken}`;
                } else {
                    this.log.logToFile('Unable to login after 401 status code');
                }

                return (await this.send(url, Uint8Array, attempts - 1));
                // handle refresh token, re-auth, etc.

            }
            else if (attempts > 1) {
                return await (this.send(url, Uint8Array, attempts-1));
            } else {
                throw new Error(err);
            }
        }
    }

    async getHomeworks() {
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() - 3);

        // 2. Get the Unix timestamp in seconds (integer part)
        const futureTimestampInSeconds = Math.floor(futureDate.getTime() / 1000);
        const nanos = (Math.floor(Math.random() * 900) + 100) * 1_000_000;

        const homeworkInput = {
            "parentName": "assignments/",
            "endTimestampAfter": {
                "seconds": futureTimestampInSeconds,
                "nanos": nanos
            }
        };

        const url = 'https://api.sparx-learning.com/science/sparx.packageactivity.v1.Packages/ListStudentPackages';

        const fullMessage = await this.encodeStuff(homeworkInput, 'ListStudentPackagesRequest');

        const positiveNounRequest = await this.send(url, fullMessage);

        const positiveNounResponse = await this.decodeStuff(positiveNounRequest.data, 'ListStudentPackagesResponse');

        return positiveNounResponse;

    }

    async getTaskItems(packageID) {
        let url = 'https://api.sparx-learning.com/science/sparx.packageactivity.v1.Packages/GetPackage';

        let fullMessage = await this.encodeStuff({packageName: packageID}, 'GeneratePackageContentsRequest'); // packages/c463f131-8e83-484f-b98f-cc215be18577
        const userInfoBuffer = await this.send(url, fullMessage);
        if (userInfoBuffer.headers['grpc-status'] === '16') {
            // console.log(`The network request was unsuccessful: ${userInfoBuffer.headers['grpc-message']}`);
            return;
        }


        const userInfo = await this.decodeStuff(userInfoBuffer.data, 'GeneratePackageContentsResponse');
        return userInfo;
    }

    async generateTaskItems(packageID) {
        let url = 'https://api.sparx-learning.com/science/sparx.packageactivity.v1.Packages/GeneratePackageContents';

        let fullMessage = await this.encodeStuff({packageName: packageID}, 'GeneratePackageContentsRequest'); // packages/c463f131-8e83-484f-b98f-cc215be18577
        const userInfoBuffer = await this.send(url, fullMessage);
        if (userInfoBuffer.headers['grpc-status'] === '16') {
            // console.log(`The network request was unsuccessful: ${userInfoBuffer.headers['grpc-message']}`);
            return;
        }


        const userInfo = await this.decodeStuff(userInfoBuffer.data, 'GeneratePackageContentsResponse');
        return userInfo;
    }

    async getQuestion(activity) {
        const questionInput = {
            "name": activity, // "activities/bf1a6415-7fc5-4462-943d-63fc71b2d9d3"
            "action": {
                "oneofKind": "view",
                "view": {
                    "unload": false
                }
            },
            "token": ""
        };

        const url = 'https://api.sparx-learning.com/science/sparx.packageactivity.v1.Activities/ActivityAction';

        const fullMessage = await this.encodeStuff(questionInput, 'ActivityActionRequest');

        const positiveNounRequest = await this.send(url, fullMessage);

        // console.log(positiveNounRequest.headers);

        const positiveNounResponse = await this.decodeStuff(positiveNounRequest.data, 'ActivityActionResponse');

        return positiveNounResponse;

    }

    async getQuestionActivity(packageID) {
        const questionActivityInput = {
            "name": "",
            "taskItemName": packageID
        };

        const url = 'https://api.sparx-learning.com/science/sparx.packageactivity.v1.Activities/GetActivity';

        const fullMessage = await this.encodeStuff(questionActivityInput, 'GetActivityRequest');

        const positiveNounRequest = await this.send(url, fullMessage);

        const positiveNounResponse = await this.decodeStuff(positiveNounRequest.data, 'GetActivityResponse');

        return positiveNounResponse;
    }

    async answerQuestion(answerObject) {
        const url = 'https://api.sparx-learning.com/science/sparx.packageactivity.v1.Activities/ActivityAction';

        const fullMessage = await this.encodeStuff(answerObject, 'ActivityActionRequest');

        const positiveNounRequest = await this.send(url, fullMessage);

        // console.log(positiveNounRequest.headers);
        if (positiveNounRequest === 9) return 9;

        const positiveNounResponse = await this.decodeStuff(positiveNounRequest.data, 'ActivityActionResponse');

        return positiveNounResponse;

    }

    async readyQuestion(activity, token) {
        const questionInput = {
            "name": activity,
            "action": {
                "oneofKind": "next",
                "next": {}
            },
            "token": token
        };

        const url = 'https://api.sparx-learning.com/science/sparx.packageactivity.v1.Activities/ActivityAction';

        const fullMessage = await this.encodeStuff(questionInput, 'ActivityActionRequest');

        const positiveNounRequest = await this.send(url, fullMessage);

        const positiveNounResponse = await this.decodeStuff(positiveNounRequest.data, 'ActivityActionResponse');

        return positiveNounResponse;
    }
}

module.exports = { SparxScience };