const { decode, encode } = require('./sm_code.js');
const { getClientSession } = require('./send_maths.js');
const { getTokenSparx, getTokenRequest } = require('./puppeteer.js');
const SparxBase = require('./sparxBase.js');

class SparxMaths extends SparxBase {
    constructor(authToken, login = {}, cookies) {
        super(authToken, login, cookies, decode, encode);
    }

    async send(url, uint8Array, attempts = 3) {
        try {
            this.log.logToFile(`Sending request to ${url}`);
            const response = await this.curlRequests.sendRequest(url, uint8Array);
            this.log.logToFile(`**Response returned**\nStatus: ${response.status}\n${JSON.stringify(response.headers, null, 2)}`);
            if (response.status == 401) {
                console.log('Caught 401 in maths');
                const err = new Error("Unauthorized");
                err.response = { status: 401 };
                throw err;
            }
            // console.log(response);

            // Check for gRPC error status

            if (response.headers['grpc-status'] === '16' || response.headers['grpc-status'] === '9' || response.headers['grpc-status'] === '7') { // grpc-message: PendingWAC
                if (response.headers['grpc-message'] === 'TaskItemHidden') {
                    this.log.logToFile('Item is hidden so just break');
                    return 'break';
                }
                if (response.headers['grpc-message'].includes('PendingWAC')) {
                    this.log.logToFile("Bookwork check caught");
                    return null;
                } else if (response.headers['grpc-message'].includes('SessionInactive')) {
                    this.log.logToFile("SESSION INACTIVE CAUGHT!");
                    await this.getClientSession(this.authToken);
                    return await (this.send(url, uint8Array, attempts));
                }
                const error = new Error(JSON.stringify(response.headers, null, 2));
                error.response = { status: 401 };
                throw error;
            }

            // Optional: convert response to hex
            // const hex = Buffer.from(response.data).toString('hex');
            // console.log(`Raw Response (Hex): ${hex}`);

            return response;

        } catch (err) {
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
                    this.log.logToFile('The new authtoken has been successfully acquired!');
                    console.log(newAuthToken);
                    this.authToken = newAuthToken;
                    this.curlRequests.headers[2] = `authorization: ${this.authToken}`;
                    await this.getClientSession(this.authToken);
                    console.log("Client session success");
                    console.log(this.sessionId);
                } else {
                    this.log.logToFile('Unable to login after 401 status code');
                }

                console.log(this.authToken);
                console.log("^Authtoken");

                return (await this.send(url, uint8Array, attempts - 1));
                // handle refresh token, re-auth, etc.

            }
            else if (attempts > 1) {
                return await (this.send(url, uint8Array, attempts - 1));
            } else {
                throw new Error(err);
            }
        }
    }

    async getHomeworks() {
        const inputObject = {
            "includeAllActivePackages": true,
            "getPackages": true,
            "getTasks": false,
            "getTaskItems": false,
            "packageID": "",
            "taskIndex": 0,
            "taskItemIndex": 0
        };

        try {
            const fullMessage = await this.encodeStuff(inputObject, 'PackageDataRequest');
            const homeworkRequest = await this.send('https://api.sparx-learning.com/sparx.swworker.v1.Sparxweb/GetPackageData', fullMessage);

            if (!homeworkRequest || !homeworkRequest.data) {
                throw new Error("Failed to fetch homeworks: Empty response");
            }

            const homeworkResponse = await this.decodeStuff(homeworkRequest.data, 'PackageDataResponse');
            return homeworkResponse;
        } catch (err) {
            this.log.logToFile(`Error in getHomeworks: ${err.message}`);
            console.error('Error in getHomeworks:', err);
            throw err;
        }
    }


    async getTasksItems(packageID, taskIndex) {
        const inputObject = {
            "includeAllActivePackages": false,
            "getPackages": false,
            "getTasks": false,
            "getTaskItems": true,
            "packageID": packageID,
            "taskIndex": taskIndex,
            "taskItemIndex": 0
        };


        const fullMessage = await this.encodeStuff(inputObject, 'PackageDataRequest');

        const homeworkRequest = await this.send('https://api.sparx-learning.com/sparx.swworker.v1.Sparxweb/GetPackageData', fullMessage); // this.authToken

        // console.log(homeworkRequest.headers);

        const homeworkResponse = await this.decodeStuff(homeworkRequest.data, 'PackageDataResponse');

        return homeworkResponse.taskItems;
    }

    async getTasks(packageID) {
        const inputObject = {
            "includeAllActivePackages": false,
            "getPackages": false,
            "getTasks": true,
            "getTaskItems": false,
            "packageID": packageID,
            "taskIndex": 0,
            "taskItemIndex": 0
        };


        const fullMessage = await this.encodeStuff(inputObject, 'PackageDataRequest');

        const homeworkRequest = await this.send('https://api.sparx-learning.com/sparx.swworker.v1.Sparxweb/GetPackageData', fullMessage); // this.authToken

        // console.log(homeworkRequest.headers);

        const homeworkResponse = await this.decodeStuff(homeworkRequest.data, 'PackageDataResponse');

        return homeworkResponse;
    }

    async getActivity(timestamp, packageID, taskIndex, taskItemIndex, activityType = 0) {
        const inputObject = {
            "activityType": activityType,
            "payload": {},
            "method": 0,
            "clientFeatureFlags": {},
            "taskItem": {
                "packageID": packageID,
                "taskIndex": taskIndex,
                "taskItemIndex": taskItemIndex,
                "taskState": 0
            },
            "timestamp": timestamp
        };

        const fullMessage = await this.encodeStuff(inputObject, 'GetActivityRequest');

        const homeworkRequest = await this.send('https://api.sparx-learning.com/sparx.swworker.v1.Sparxweb/GetActivity', fullMessage); // this.authToken

        if (!homeworkRequest || homeworkRequest === 'break') {
            return homeworkRequest;
        }

        // console.log(homeworkRequest.headers);

        const homeworkResponse = await this.decodeStuff(homeworkRequest.data, 'Activity');

        return homeworkResponse;
    }

    async getClientSession() {
        const responseBuffer = await getClientSession(this.curlRequests);
        // console.log(responseBuffer);
        const response = await this.decodeStuff(responseBuffer, "ClientSessionResponse");
        // console.log(response.sessionId);
        this.sessionId = response.sessionId;
        this.curlRequests.headers = this.curlRequests.headers.map(header =>
            header.startsWith('x-session-id:')
                ? `x-session-id: ${this.sessionId}`
                : header
        );

        return response.sessionId;
    }


    async answerQuestion(inputObject) {

        const fullMessage = await this.encodeStuff(inputObject, 'ActivityAction');

        const answerRequest = await this.send('https://api.sparx-learning.com/sparx.swworker.v1.Sparxweb/ActivityAction', fullMessage); // this.authToken

        const answerResponse = await this.decodeStuff(answerRequest.data, 'ActivityActionResponse');
        // console.log(answerRequest.headers);

        return answerResponse;
    }

    async readyQuestion(inputObject) {

        const fullMessage = await this.encodeStuff(inputObject, 'ActivityAction');

        const answerRequest = await this.send('https://api.sparx-learning.com/sparx.swworker.v1.Sparxweb/ActivityAction', fullMessage); // this.authToken

        const answerResponse = await this.decodeStuff(answerRequest.data, 'ActivityActionResponse');

        return answerResponse;
    }

    async startTimesTable(inputObject) {
        const fullMessage = await this.encodeStuff(inputObject, 'GetActivityRequest');

        const answerRequest = await this.send('https://api.sparx-learning.com/sparx.swworker.v1.Sparxweb/GetActivity', fullMessage); // this.authToken

        const answerResponse = await this.decodeStuff(answerRequest.data, 'ActivityAction');

        return answerResponse;
    }

    async answerTimesTable(inputObject) {
        const fullMessage = await this.encodeStuff(inputObject, 'ActivityAction');

        const answerRequest = await this.send('https://api.sparx-learning.com/sparx.swworker.v1.Sparxweb/ActivityAction', fullMessage); // this.authToken

        const answerResponse = await this.decodeStuff(answerRequest.data, 'ActivityActionResponse');

        return answerResponse;
    }

    async searchIndependantLearning(inputObject) {
        const fullMessage = await this.encodeStuff(inputObject, 'Query');

        const answerRequest = await this.send('https://api.sparx-learning.com/sparx.content.search.v1.Search/Search', fullMessage); // this.authToken

        const answerResponse = await this.decodeStuff(answerRequest.data, 'Result');

        return answerResponse;
    }

    async getPackagesIndependantLearning(inputObject) {
        const fullMessage = await this.encodeStuff(inputObject, 'GetPackagesForObjectivesRequest');

        const answerRequest = await this.send('https://api.sparx-learning.com/sparx.revision.v1.Revision/GetPackagesForObjectives', fullMessage); // this.authToken

        const answerResponse = await this.decodeStuff(answerRequest.data, 'GetPackagesForObjectivesResponse');

        return answerResponse;
    }

    async getActivePackages(inputObject) {
        const fullMessage = await this.encodeStuff(inputObject, 'GetActivePackagesRequest');

        const answerRequest = await this.send('https://api.sparx-learning.com/sparx.revision.v1.Revision/GetActivePackages', fullMessage); // this.authToken

        const answerResponse = await this.decodeStuff(answerRequest.data, 'GetActivePackagesResponse');

        return answerResponse;
    }

    async listTopicSummariesRequest(inputObject) {
        const fullMessage = await this.encodeStuff(inputObject, 'ListTopicSummariesRequest');

        const answerRequest = await this.send('https://api.sparx-learning.com/sparx.content.summaries.v1.TopicSummaries/ListTopicSummaries', fullMessage); // this.authToken

        const answerResponse = await this.decodeStuff(answerRequest.data, 'ListTopicSummariesResponse');

        return answerResponse;
    }

    async listCurriculumSummaries(inputObject) {
        const fullMessage = await this.encodeStuff(inputObject, 'ListCurriculumSummariesRequest');

        const answerRequest = await this.send('https://api.sparx-learning.com/sparx.content.summaries.v1.CurriculumSummaries/ListCurriculumSummaries', fullMessage); // this.authToken

        const answerResponse = await this.decodeStuff(answerRequest.data, 'ListCurriculumSummariesResponse');

        return answerResponse;
    }
}

module.exports = { SparxMaths };