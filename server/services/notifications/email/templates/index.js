const customerInvitation = require('./customerInvitation')
const activation = require('./activation')
const invitation = require('./invitation')
const passwordRecover = require('./passwordRecover')
const registration = require('./registration')

module.exports = {
  customerInvitation: customerInvitation,
  activation: activation,
  invitation: invitation,
  passwordRecover: passwordRecover,
  registration: registration
}
