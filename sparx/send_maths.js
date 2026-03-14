require('dotenv').config();

// gRPC-Web body (5 bytes of zero, gRPC framing for Empty message)
// const body = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]);

async function getClientSession(requesticator) {
    
    const body = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]);

    const response = await requesticator.sendRequest("https://api.sparx-learning.com/sparx.messaging.server.v1.SWServerSession/ClientSession", body, { responseType: 'arraybuffer', returnHeaders: true  });

    return response.data;
}

module.exports = { getClientSession };