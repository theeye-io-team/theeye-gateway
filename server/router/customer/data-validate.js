const isEmail = require('validator/lib/isEmail')
const EscapedRegExp = require('../../escaped-regexp')
const { ClientError, ServerError } = require('../../errors')
const { validUsername } = require('../user/data-validate')

const validateCustomerName = async (app, name) => {
  if (!validUsername(name)) {
    throw new ClientError('The organization name can contains 6 to 20 letters (a-z), numbers (0-9), period (.), underscore (_) and hyphen (-). It must starts and ends with an alphanumeric symbol')
  }

  customer = await app.models.customer.findOne({ name: new EscapedRegExp(name, 'i') })
  if (customer !== null) {
    throw new ClientError('The customer name is in use')
  }
}

module.exports = { validateCustomerName }
