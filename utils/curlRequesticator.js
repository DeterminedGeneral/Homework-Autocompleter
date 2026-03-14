const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

class SimpleMutex {
    constructor() {
        this.queue = [];
        this.locked = false;
    }
    async acquire() {
        return new Promise(resolve => {
            const release = () => {
                if (this.queue.length > 0) {
                    const next = this.queue.shift();
                    next();
                } else {
                    this.locked = false;
                }
            };
            if (!this.locked) {
                this.locked = true;
                resolve(release);
            } else {
                this.queue.push(() => resolve(release));
            }
        });
    }
}

class PythonWorker {
    constructor() {
        this.scriptPath = path.resolve(__dirname, '../tools/curl_cffi_script.py');
        this.process = null;
        this.mutex = new SimpleMutex();
        this.currentResolver = null;
        this.buffer = '';
    }

    start() {
        if (this.process && !this.process.killed) return;
        
        console.log('Starting Persistent Python Worker...');
        
        // CHECK PLATFORM: Use 'python' on Windows, 'python3' on Mac/Linux
        const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

        this.process = spawn(pythonCommand, [this.scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout.on('data', (data) => {
            this.buffer += data.toString();
            this.processBuffer();
        });

        this.process.stderr.on('data', (data) => {
            console.error('Python Stderr:', data.toString());
        });

        this.process.on('close', (code) => {
            console.log(`Python Worker exited with code ${code}`);
            this.process = null;
            if (this.currentResolver) {
                this.currentResolver.reject(new Error('Python worker process exited unexpectedly'));
                this.currentResolver = null;
            }
            this.buffer = '';
        });
    }

    processBuffer() {
        let newlineIndex;
        while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
            const line = this.buffer.slice(0, newlineIndex).trim();
            this.buffer = this.buffer.slice(newlineIndex + 1);
            
            if (line && this.currentResolver) {
                this.currentResolver.resolve(line);
                this.currentResolver = null;
            }
        }
    }

    async execute(requestData) {
        if (!this.process) this.start();
        
        const release = await this.mutex.acquire();
        try {
            return await new Promise((resolve, reject) => {
                this.currentResolver = { resolve, reject };
                
                if (!this.process.stdin.write(JSON.stringify(requestData) + '\n')) {
                    this.process.stdin.once('drain', () => {});
                }
            });
        } finally {
            release();
        }
    }
}

const globalPythonWorker = new PythonWorker();

class curlRequesticator {
  constructor(cookies) {
    this.cookies = cookies;
  }

  async _executeCurl(url, headers, data = null, options = {}) {
    const requestData = {
        url: url,
        method: data ? 'POST' : 'GET',
        headers: {},
        cookies: this.cookies,
        data: null,
        is_binary_data: false
    };

    if (Array.isArray(headers)) {
        headers.forEach(h => {
            const parts = h.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim().toLowerCase();
                const value = parts.slice(1).join(':').trim();
                requestData.headers[key] = value;
            }
        });
    }

    if (Buffer.isBuffer(data)) {
        requestData.data = data.toString('base64');
        requestData.is_binary_data = true;
    } else if (data) {
        requestData.data = typeof data === 'object' ? JSON.stringify(data) : data;
    }

    try {
        const responseLine = await globalPythonWorker.execute(requestData);
        const result = JSON.parse(responseLine);
        
        if (result.error) {
            throw new Error(result.error);
        }

        const bodyBuffer = Buffer.from(result.body, 'base64');
        let responseBody;

        if (options.responseType === 'arraybuffer') {
            responseBody = bodyBuffer;
        } else {
            const bodyString = bodyBuffer.toString('utf8');
            try {
                responseBody = JSON.parse(bodyString);
            } catch {
                responseBody = bodyString;
            }
        }

        if (options.returnHeaders) {
            return {
                status: result.statusCode,
                headers: result.headers,
                data: responseBody
            };
        } else {
            return responseBody;
        }

    } catch (e) {
        console.error('Python Request Failed:', e.message);
        throw e;
    }
  }
}

module.exports = curlRequesticator;