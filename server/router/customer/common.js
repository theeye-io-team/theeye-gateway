const EscapedRegExp = require('../../escaped-regexp')
const { ClientError, ServerError } = require('../../errors')
const createAgentUser = require('./create-agent')

const customerNamePattern = /^(?=.{6,}$)(?![_.-])(?!.*[_.-]{2})[a-zA-Z0-9._-]+(?<![_.-])$/

const { v5: uuidv5 } = require('uuid')
const CUSTOMER_NAMESPACE = 'e8ae2f14-ec7b-4246-9cf3-a9729c5b682b'

const validateCustomerName = async (app, name) => {
  if (!customerNamePattern.test(name)) {
    throw new ClientError('The organization name must be at least 6 characters long. Letters (a-z), numbers (0-9), period (.), underscore (_) and hyphen (-) are allowed. It must starts and ends with an alphanumeric symbol')
  }

  customer = await app.models.customer.findOne({ name: new EscapedRegExp(name, 'i') })
  if (customer !== null) {
    throw new ClientError('The customer name is in use')
  }
}

const create = async (app, data) => {

  const creation_date = new Date()

  if (!data.name) {
    // autogenerate a timestamp based customer name
    const name = uuidv5(creation_date.getTime().toString(), CUSTOMER_NAMESPACE) 
    data.name = name
  } else {
    await validateCustomerName(app, data.name)
  }

  if (data.alias) {
    if (customerNamePattern.test(data.alias) === false) {
      throw new ClientError('The alias must be at least 6 characters long. Letters (a-z), numbers (0-9), period (.), underscore (_) and hyphen (-) are allowed. It must starts and ends with an alphanumeric symbol')
    }

    const doc = await app.models.customer.findOne({
      alias: new EscapedRegExp(data.alias, 'i') 
    })

    if (doc !== null) {
      throw new ClientError('The customer name is in use')
    }
  } else {
    data.alias = data.name
  }

  data.creation_date = creation_date

  const customer = await app.models.customer.create(data)
  await customer.save()

  await createAgentUser(app, customer)
  return customer
}

module.exports = { validateCustomerName, create }
