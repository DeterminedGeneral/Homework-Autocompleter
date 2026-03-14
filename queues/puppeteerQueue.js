const { default: PQueue } = require('p-queue');
// OR just: const PQueue = require('p-queue'); (depending on how v6 exports)

const puppetQueue = new PQueue({
  concurrency: 3,
});

module.exports = puppetQueue;