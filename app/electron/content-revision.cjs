const { createHash } = require('node:crypto')

function createContentRevision(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

module.exports = {
  createContentRevision,
}
