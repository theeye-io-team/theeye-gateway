
const EscapedRegExp = require('../../escaped-regexp')
const isEmail = require('validator/lib/isEmail')
const { ClientError, ServerError } = require('../../errors')

const validateUserData = (data) => {
  if (typeof data.enabled !== 'boolean') {
    throw new ClientError('enabled is required')
  }
  if (!data.email) {
    throw new ClientError('email is required')
  }
  if (!isEmail(data.email)) {
    throw new ClientError('email is invalid')
  }
  if (!data.username) {
    throw new ClientError('username is required')
  }
  if (!validUsername(data.username)) {
    if (data.username !== data.email) { // the user will have to verify the email
      throw new ClientError('The username can contains 6 to 20 letters (a-z), numbers (0-9), period (.), underscore (_) and hyphen (-)')
    }
  }
  if (!data.name) {
    throw new ClientError('name is required')
  }
  if (data.password) {
    if (data.password !== data.confirmPassword) {
      throw new ClientError('Passwords doesn\'t match')
    }
    if (data.password.length < 8) {
      throw new ClientError('Passwords should be at least 8 characters long')
    }
  }
}

const theeyeUsername = /^(?=.{6,20}$)(?![_.-])(?!.*[_.-]{2})[a-zA-Z0-9._-]+(?<![_.-])$/
const validUsername = (username) => {
  if (isEmail(username)) {
    const userPart = username.split('@')[0]
    return theeyeUsername.test(userPart)
  }

  return theeyeUsername.test(username)
}

const isUsernameAvailable = async (app, data, currentUser = null) => {
  const { email, username } = data
  let user = await app.models.users.user.findOne({
    $or: [
      { email: new EscapedRegExp(email, 'i') },
      { username: new EscapedRegExp(username, 'i') }
    ]
  })

  if (user) {
    if (!currentUser || currentUser._id.toString() !== user._id.toString()) {
      if (user.username.toLowerCase() === username.toLowerCase()) {
        throw new ClientError('Username is in use. Choose another one')
      }
      if (user.email.toLowerCase() === email.toLowerCase()) {
        throw new ClientError('Email is in use. Choose another one')
      }
    }
  }
}

module.exports = { validateUserData, validUsername, isUsernameAvailable }
