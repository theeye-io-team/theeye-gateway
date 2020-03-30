const logger = require('../logger')('libs:notifications:email')
const mailer = require('../../services/mailer')

module.exports = {
  send (data, users) {
    users.forEach((user) => {
      mailer.sendEmail({data, user})
    })
  }
}
