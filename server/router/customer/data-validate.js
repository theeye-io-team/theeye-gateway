const EscapedRegExp = require('../../escaped-regexp')
const { ClientError, ServerError } = require('../../errors')

const customerNamePattern = /^(?=.{6,}$)(?![_.-])(?!.*[_.-]{2})[a-zA-Z0-9._-]+(?<![_.-])$/
const validateCustomerName = async (app, name) => {
  if (!customerNamePattern.test(name)) {
    throw new ClientError('The organization should be at least 6 characters long, letters (a-z), numbers (0-9), period (.), underscore (_) and hyphen (-) are allowed. It must starts and ends with an alphanumeric symbol')
  }

  customer = await app.models.customer.findOne({ name: new EscapedRegExp(name, 'i') })
  if (customer !== null) {
    throw new ClientError('The customer name is in use')
  }
}

module.exports = { validateCustomerName }
