const fs = require('fs')
const Encryption = require('./encryption')

const main = (action, input) => {
  const iv = Buffer.from(process.env.THEEYE_CONFIG_ENCRYPTED_IV, 'hex')
  if (!iv) throw new Error('iv required. use THEEYE_CONFIG_IV')

  const secretKey = Buffer.from(process.env.THEEYE_CONFIG_ENCRYPTED_SECRET, 'hex')
  if (!secretKey) throw new Error('secret key required. use THEEYE_CONFIG_SECRET')

  const algorithm = process.env.THEEYE_CONFIG_ENCRYPTED_ALGORITHM
  if (!algorithm) throw new Error('algorithm required. use THEEYE_CONFIG_ALGORITHM')

  const encdec = new Encryption({ iv, algorithm, secretKey })

  const content = fs.readFileSync(input, 'utf8')
  return encdec[action](content)
}

module.exports = main

/**
 * called directly from commnand line
 */
if (require.main === module) {
  const action = process.argv[2]

  if (action !== 'encrypt' && action !== 'decrypt') {
    throw new Error(`Invalid option ${action}. Use encrypt or decrypt`)
  }

  const input = process.argv[3]
  const data = main(action, input)
  console.log(data)
}
