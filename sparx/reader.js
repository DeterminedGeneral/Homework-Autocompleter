const { decode, encode } = require('./sr_code.js');
const { getTokenSparx, getTokenRequest } = require('./puppeteer.js');
const { answerQuestionAi } = require('../gemini/sparx_reader/main.js');
const { addToDb, checkAnswer } = require('../database/main.js');
const SparxBase = require('./sparxBase.js');

class SparxReader extends SparxBase {
    constructor(authToken, login={}, cookies) {
        super(authToken, login, cookies, decode, encode);
    }

    async send(url, Uint8Array, attempts=3) {

        try {

        this.log.logToFile(`Sending request to ${url}`);
        const response = await this.curlRequests.sendRequest(url, Uint8Array);
        this.log.logToFile(`**Response returned**\nStatus: ${response.status}\n${JSON.stringify(response.headers, null, 2)}`);
        if (response.status == 401) {
            console.log('Caught 401 error');
            const err = new Error("Unauthorized");
            err.response = { status: 401 };
            throw err;
        }

        /*
        const body = Buffer.from(Uint8Array);
        const bodyHex = body.toString("hex");
        const response = await axios.post(url, body, {
        headers,
        responseType: 'arraybuffer'
        });
        */

        // console.log('Status:', response.status);
        // console.log('Headers:', response.headers);

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
                    this.log.logToFile("Unable to login after 401 status code");
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
        // https://api.sparx-learning.com/reader/sparx.reading.users.librarybooks.v1.LibraryBooks/ListLibraryBooks
        // console.log(this.authToken);
        let url = 'https://api.sparx-learning.com/reader/sparx.reading.users.librarybooks.v1.LibraryBooks/ListLibraryBooks';

        let fullMessage = await this.encodeStuff({}, 'UpdateUserDisplayDataForCurrentUserRequest');

        const userInfoBuffer = await this.send(url, fullMessage);
        if (userInfoBuffer.headers['grpc-status'] === '16') {
            // console.log(`The network request was unsuccessful: ${userInfoBuffer.headers['grpc-message']}`);
            return;
        }
        const libraryBooks = await this.decodeStuff(userInfoBuffer.data, 'ListLibraryBooks');
        const activeBooks = [];

        for (const book of libraryBooks.libraryBooks) {
            if (book.studentBook.isActive || book.studentBook.isTeacherAssigned) {
                const progress = Math.round(book.studentBook.progress * 100);
                const bookObj = {
                    title: book.studentBook.title,
                    bookId: book.studentBook.bookId,
                    progress: progress
                };
                if (book.studentBook.isTeacherAssigned) {
                    if (progress < 100) {
                        bookObj.setBook = true;
                        activeBooks.push(bookObj);
                    }
                } else {
                    bookObj.setBook = false;
                    activeBooks.push(bookObj);
                }
            }
        }

        // console.log(activeBooks);
        return activeBooks;



        // Convert to JSON string
        /*
        const jsonData = JSON.stringify(libraryBooks, null, 2); // pretty print with 2-space indentation
        console.log(jsonData);
        const filePath = path.resolve(__dirname, '../data.json'); // or './data.json' to write to current folder

        // Write to file
        fs.writeFile(filePath, jsonData, (err) => {
        if (err) {
            console.error('Error writing file', err);
        } else {
            console.log('JSON data written to file successfully');
        }
        });
        */


    }

    async getGoldReaderState() {
        let url = 'https://api.sparx-learning.com/reader/sparx.reading.users.v1.Sessions/GetGoldReaderState';

        let fullMessage = await this.encodeStuff({}, 'UpdateUserDisplayDataForCurrentUserRequest');

        const userInfoBuffer = await this.send(url, fullMessage);
        if (userInfoBuffer.headers['grpc-status'] === '16') {
            // console.log(`The network request was unsuccessful: ${userInfoBuffer.headers['grpc-message']}`);
            return;
        }

        const userInfo = await this.decodeStuff(userInfoBuffer.data, 'GetGoldReaderStateResponse');
        return userInfo.goldReaderState;
    }

    async getBookText(bookId, taskId) {
        // https://api.sparx-learning.com/reader/sparx.reading.content.v1.Books/GetBook
        
        // console.log(this.authToken);
        let url = 'https://api.sparx-learning.com/reader/sparx.reading.content.v1.Books/GetBook';

        const bookRequest = {
            "bookId": bookId,
            "taskId": taskId
        };

        let fullMessage = await this.encodeStuff(bookRequest, 'GetBookRequest');

        // console.log("Get book text calls send");
        const userInfoBuffer = await this.send(url, fullMessage);
        if (userInfoBuffer.headers['grpc-status'] === '16') {
            // console.log(`The network request was unsuccessful: ${userInfoBuffer.headers['grpc-message']}`);
            return;
        }

        const bookText = await this.decodeStuff(userInfoBuffer.data, 'GetBookResponse');

        // console.log(bookText.bookV2.content.reflowable.body.sections[0]);

        let paragraph = "";
        let wordCount = 0;

        for (const text of bookText.bookV2.content.reflowable.body.sections) {
            // console.log(text.content.paragraph.spans);
            if (text.content.oneofKind === 'paragraph') {
                // console.log(text.content.paragraph.spans[0].runs[0].content);
                for (const span of text.content.paragraph.spans) {
                    wordCount += span.wordCount;
                    for (const run of span.runs) {
                        const textBody = run.content;
                        paragraph += ` ${textBody}`;
                    }
                }
                // const textBody = text.content.paragraph.spans[0].runs[0].content;
                // paragraph += ` ${textBody}`;
            }
        }

        // console.log(paragraph);

        // console.log(bookText);

        /*
        const jsonData = JSON.stringify(bookText, null, 2); // pretty print with 2-space indentation
        console.log(jsonData);
        const filePath = path.resolve(__dirname, '../data.json'); // or './data.json' to write to current folder

        // Write to file
        fs.writeFile(filePath, jsonData, (err) => {
        if (err) {
            console.error('Error writing file', err);
        } else {
            console.log('JSON data written to file successfully');
        }
        });
        */

        return { paragraph: paragraph, wordCount: wordCount };

    }

    async getBookTask(bookId) {
        const url = "https://api.sparx-learning.com/reader/sparx.reading.tasks.v1.Tasks/GetBookTask";
        const bookObj = {
            "bookId": bookId,
            "requestReread": true
        };
        const proceedMessage = await this.encodeStuff(bookObj, 'GetBookTaskRequest');

        // console.log("Book task calls send");
        const questionBuffer = await this.send(url, proceedMessage);
        if (questionBuffer === 8) {
            return 8;
        }


        const questionFull = await this.decodeStuff(questionBuffer.data, 'GetBookTaskResponse');

        // console.log(questionFull.loadTaskId);
        return questionFull.loadTaskId;

    }

    async proceedTimeout(taskId) {
        const url = 'https://api.sparx-learning.com/reader/sparx.reading.tasks.v1.Tasks/SendTaskAction';
        const proceedObj = {
            "taskId": taskId,
            "action": {
                "action": {
                    "oneofKind": "paperback",
                    "paperback": {
                        "action": {
                            "oneofKind": "answer",
                            "answer": "<timeout>"
                        },
                        "identifier": ""
                    }
                }
            },
            "catchUpMode": false,
            "signatureEvent": {
                "signatures": []
            }
        };


        const proceedMessage = await this.encodeStuff(proceedObj, 'SendTaskActionRequest');
        // console.log("proceed question buffer calls send");
        await this.send(url, proceedMessage);
    }

    async proceedQuestion(taskId) {

        const url = 'https://api.sparx-learning.com/reader/sparx.reading.tasks.v1.Tasks/SendTaskAction';
        const proceedObj = {
            "taskId": taskId,
            "action": {
                "action": {
                    "oneofKind": "paperback",
                    "paperback": {
                        "action": {
                            "oneofKind": "proceed",
                            "proceed": true
                        },
                        "identifier": ""
                    }
                }
            },
            "catchUpMode": false,
            "signatureEvent": {
                "signatures": []
            }
        };

        const proceedMessage = await this.encodeStuff(proceedObj, 'SendTaskActionRequest');
        // console.log("proceed question buffer calls send");
        const questionBuffer = await this.send(url, proceedMessage);

        if (questionBuffer.headers['grpc-status'] === '9') {
            if (questionBuffer.headers['grpc-message'] === 'task is completed') {
                await this.retryQuestion(taskId);
            } else {
                await this.proceedTimeout(taskId);
            }
            return 9;
        }

        const questionFull = await this.decodeStuff(questionBuffer.data, 'SendTaskActionResponse');
        // console.log(questionFull);
 
        if (questionFull?.task?.state?.state?.paperback?.currentQuestion) {
            const questionIdentifier = questionFull.task.state.state.paperback.currentQuestion.questionId;
            const questionText = questionFull.task.state.state.paperback.currentQuestion.questionText;
            const questionOptions = questionFull.task.state.state.paperback.currentQuestion.options;
            
            // console.log("Q full here");
            // console.log(questionFull.task.state.state.paperback.results);
            
            if (questionFull?.task?.state?.experience) {
                // console.log(`Experience Gained: ${questionFull.task.state.experience}`);
                return {
                    experience: questionFull.task.state.experience,
                    results: questionFull.task.state.results
                };
            }

            const questionObject = {
                questionIdentifier: questionIdentifier,
                questionText: questionText,
                questionOptions: questionOptions
            };

            return questionObject;
        } else {
            return await this.proceedQuestion(taskId);
        }
    }

    async retryQuestion(taskId) {
        let url = 'https://api.sparx-learning.com/reader/sparx.reading.tasks.v1.Tasks/SendTaskAction';
        const proceedObj = {
            "taskId": taskId,
            "action": {
                "action": {
                    "oneofKind": "retry",
                    "retry": true
                }
            },
            "catchUpMode": false
        };

        const proceedMessage = await this.encodeStuff(proceedObj, 'SendTaskActionRequest');
        // console.log("Retry question buffer calls send");
        await this.send(url, proceedMessage);

        // const questionFull = await this.decodeStuff(questionBuffer.data, 'SendTaskActionResponse');
        // console.log(questionFull);
        // console.log("retry question");
        // console.log(questionFull.task.state.state.paperback);
    }

    async answerQuestion(extract, taskId, first, answer, identifier) {

        let url = 'https://api.sparx-learning.com/reader/sparx.reading.tasks.v1.Tasks/SendTaskAction';

        if (first) {
            const questionObj = await this.proceedQuestion(taskId);
            if (questionObj === 9) {
                // console.log("Finished questions!");
                return;
            }
            identifier = questionObj.questionIdentifier;
            // console.log(`Question Identifier: ${identifier}`);

            /*
            const answerDigit = await answerQuestionAi(extract, questionObj.questionText, questionObj.questionOptions);
            answer = questionObj.questionOptions[answerDigit-1];
            */
            answer = await this.getAnswer(questionObj.questionIdentifier, extract, questionObj);
            if (typeof answer === 'number') return answer;
        }
        // console.log(`Answer: ${answer}`);
        // console.log("Pre");

        let answerObj = {
            "taskId": taskId,
            "action": {
                "action": {
                    "oneofKind": "paperback",
                    "paperback": {
                        "action": {
                            "oneofKind": "answer",
                            "answer": answer
                        },
                        "identifier": identifier
                    }
                }
            },
            "catchUpMode": false,
            "signatureEvent": {
                "signatures": []
            }
        };

        let fullMessage = await this.encodeStuff(answerObj, 'SendTaskActionRequest');

        // console.log("Answer question buffer base calls send");
        const questionBuffer = await this.send(url, fullMessage);

        /*
        console.log("Answer question");
        console.log(questionBuffer.headers);
        console.log("-----");
        */

        if (questionBuffer.headers['grpc-status'] === '16') {
            // console.log(`The network request was unsuccessful: ${questionBuffer.headers['grpc-message']}`);
            return;
        }

        const questionFull = await this.decodeStuff(questionBuffer.data, 'SendTaskActionResponse');

        // console.log("Base");
        // console.log(questionFull?.task?.state?.state?.paperback?.results);
        if (questionFull?.task?.state?.state?.paperback?.results) {
            await this.handleDbAdd(questionFull.task.state.state.paperback.results);
        }


        if (questionFull?.task?.state?.experience) {
            // console.log(`Experience Gained: ${questionFull.task.state.experience}`);
            const returnObj = {
                experience: questionFull.task.state.experience,
                results: questionFull.task.state.results
            };
            return returnObj;
        }

        if (questionFull?.task?.state?.state?.paperback?.currentQuestion) {
            // console.log("Other path");
            const questionIdentifier = questionFull.task.state.state.paperback.currentQuestion.questionId;
            const questionText = questionFull.task.state.state.paperback.currentQuestion.questionText;
            const questionOptions = questionFull.task.state.state.paperback.currentQuestion.options;

            const questionObj = {
                questionIdentifier: questionIdentifier,
                questionText: questionText,
                questionOptions: questionOptions
            };


            // console.log(questionObj.questionText);
            // console.log(questionObj.questionOptions);
            // console.log(questionObj.questionIdentifier);

            /*
            const answerDigit = await answerQuestionAi(extract, questionObj.questionText, questionObj.questionOptions);
            answer = questionObj.questionOptions[answerDigit-1];
            */
            answer = await this.getAnswer(questionObj.questionIdentifier, extract, questionObj);
            if (typeof answer === 'number') return answer;

            return await this.answerQuestion(extract, taskId, false, answer, questionObj.questionIdentifier);
        }

        const questionObj = await this.proceedQuestion(taskId);
        if (questionObj === 9) {
            // console.log("Finished questions!");
            await this.retryQuestion(taskId);
            return {
                experience: 0,
                results: []
            };
        } else if (questionObj?.experience) {
            // console.log("Finished questions early with this xp!");
            // console.log(questionObj.experience);
            return questionObj;
        }

        // console.log(questionObj.questionText);
        // console.log(questionObj.questionOptions);
        // console.log(questionObj.questionIdentifier);

        /*
        const answerDigit = await answerQuestionAi(extract, questionObj.questionText, questionObj.questionOptions);
        answer = questionObj.questionOptions[answerDigit-1];
        */
        answer = await this.getAnswer(questionObj.questionIdentifier, extract, questionObj);
        if (typeof answer === 'number') return answer;

        return await this.answerQuestion(extract, taskId, false, answer, questionObj.questionIdentifier);

    }

    async getNewBookOptions() {
        let url = 'https://api.sparx-learning.com/reader/sparx.reading.users.librarybooks.v1.LibraryBooks/ListNewBooks';

        let fullMessage = await this.encodeStuff({"userId": ""}, 'ListNewBooksRequest');

        const userDisplayBuffer = await this.send(url, fullMessage);
        if (userDisplayBuffer.headers['grpc-status'] === '16') {
            return null;
        }

        const userDisplayData = await this.decodeStuff(userDisplayBuffer.data, 'ListNewBooksResponse');

        return userDisplayData;
    }

    async handleDbAdd(results) {
        for (const result of results) {
            if (result.correct) {
                await addToDb(result.questionId, result.answer, []);
            } else {
                await addToDb(result.questionId, null, [result.answer]);
            }
        }
    }

    async getAnswer(id, extract, questionObj) {
        const result = await checkAnswer(id);
        // console.log(`Result for ${id}: ${result}`);
        if (typeof(result) === "string") {
            // console.log("DB is Correct");
            return result;
        } else if (Array.isArray(result)) {
            // console.log("DB has incorrect section");
            const answer = await answerQuestionAi(this.apikey, extract, questionObj.questionText, questionObj.questionOptions, result);
            if (typeof answer === 'number') return answer;
            // const answer = questionObj.questionOptions[answerDigit-1];
            return answer;
        } else {
            // console.log("DB is null");
            const answer = await answerQuestionAi(this.apikey, extract, questionObj.questionText, questionObj.questionOptions);
            if (typeof answer === 'number') return answer;
            // const answer = questionObj.questionOptions[answerDigit-1];
            return answer;
        }
    }
}

module.exports = { SparxReader };