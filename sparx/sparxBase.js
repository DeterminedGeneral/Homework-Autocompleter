const Sparx_Requesticator = require('./requesticator.js');

class SparxBase {
    /**
     * @param {string} authToken 
     * @param {object} login 
     * @param {string} cookies 
     * @param {function} decodeFunc - The subject-specific decode function
     * @param {function} encodeFunc - The subject-specific encode function
     */
    constructor(authToken, login = {}, cookies, decodeFunc, encodeFunc) {
        this.authToken = authToken;
        this.login = login;
        this.cookies = cookies;
        this.decodeFunc = decodeFunc;
        this.encodeFunc = encodeFunc;
        this.studentUserId = null;
        this.log = {
            logToFile: () => {}
        };
        
        // Default Requesticator
        this.curlRequests = new Sparx_Requesticator(authToken);
    }

    stripGrpcWebTrailer(uint8Array) {
        const TRAILER_FLAG = 0x80;
        const dataView = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);

        for (let i = 0; i <= uint8Array.length - 5; i++) {
            const isTrailer = (uint8Array[i] & TRAILER_FLAG) === TRAILER_FLAG;

            if (isTrailer) {
                const length = dataView.getUint32(i + 1); // Big-endian by default
                if (i + 5 + length === uint8Array.length) {
                    return uint8Array.slice(0, i); // trailer detected and stripped
                }
            }
        }
        return uint8Array; // no trailer found
    }

    async decodeStuff(buffer, className) {
        const bytes = new Uint8Array(buffer);
        let bytesNoStart = bytes.slice(5, bytes.length); // Remove compression flag and grpc header
        let trimmed = this.stripGrpcWebTrailer(bytesNoStart);
        const data = await this.decodeFunc(trimmed, className);
        return data;
    }

    async encodeStuff(inputObject, className) {
        const data = await this.encodeFunc(inputObject, className);

        const grpcHeader = Buffer.alloc(5);
        grpcHeader.writeUInt8(0, 0); // Compression flag (0 = not compressed)
        grpcHeader.writeUInt32BE(data.length, 1);
        const fullMessage = Buffer.concat([grpcHeader, data]);

        return fullMessage;
    }

    async getUserDisplayName() {
        const url = 'https://api.sparx-learning.com/sparx.leaderboards.userdisplay.v1.UserDisplay/GetUserDisplayDataForCurrentUser';
        const fullMessage = await this.encodeStuff({}, 'GetUserDisplayDataForCurrentUserRequest');

        const userDisplayBuffer = await this.send(url, fullMessage);
        if (userDisplayBuffer.headers['grpc-status'] === '16') {
            return null;
        }

        const userDisplayData = await this.decodeStuff(userDisplayBuffer.data, 'UserDisplayData');
        return userDisplayData.positiveNoun || 'User';
    }

    async getUserInfo() {
        const url = 'https://api.sparx-learning.com/sparx.auth.userinfo.v1.UserInfoService/GetUserInfo';
        const fullMessage = await this.encodeStuff({}, 'UpdateUserDisplayDataForCurrentUserRequest');

        const userInfoBuffer = await this.send(url, fullMessage);
        if (userInfoBuffer?.headers['grpc-status'] === '16') {
            return;
        }

        const userInfo = await this.decodeStuff(userInfoBuffer.data, 'UserInfo');
        if (userInfo.subject) {
            this.studentUserId = (userInfo.subject.split('/'))[1];
        }
        return userInfo;
    }

    async changePositiveNoun(noun) {
        const positiveNounInput = {
            "userDisplayData": {
                "name": `users/${this.studentUserId}/userdisplaydata`,
                "positiveNoun": noun,
                "optedOutProducts": []
            },
            "updateMask": {
                "paths": ["positive_noun", "opted_out_products"]
            }
        };

        const url = 'https://api.sparx-learning.com/sparx.leaderboards.userdisplay.v1.UserDisplay/UpdateUserDisplayDataForCurrentUser';
        const fullMessage = await this.encodeStuff(positiveNounInput, 'UpdateUserDisplayDataForCurrentUserRequest');

        const positiveNounRequest = await this.send(url, fullMessage);

        if (positiveNounRequest.headers['grpc-status'] === '3') {
            return 3;
        }
        return 1;
    }
}

module.exports = SparxBase;