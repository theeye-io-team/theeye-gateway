
const EscapedRegExp = require('../../escaped-regexp')
const isEmail = require('validator/lib/isEmail')
const { ClientError, ServerError } = require('../../errors')

const validateUserData = (data) => {
  if (typeof data.enabled !== 'boolean') {
    throw new ClientError('enabled is required')
  }
  if (!data.email || typeof data.email !== 'string') {
    throw new ClientError('email is required')
  }
  if (!isEmail(data.email)) {
    throw new ClientError('email is invalid')
  }
  if (
    data.username !== undefined &&
    data.username !== null &&
    !validUsername(data.username)
  ) {
    throw new ClientError('The username is not valid. It could be and Email or local-part of an Email')
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

const validUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return false
  }
  if (isEmail(username)) {
    return true
  }
  if (isEmail(`${username}@theeye.io`)) {
    return true
  }
  return false
}

const isUserKeyAvailable = async (app, data, currentUser = null) => {
  let { email, username } = data
  if (!email) {
    throw new ClientError('Email is required')
  }

  if (!username) {
    username = email
  }

  email = email.toLowerCase()
  username = username.toLowerCase()

  const query = {
    $and: [
      {
        $or: [
          { email: new EscapedRegExp(email, 'i') },
          { email: new EscapedRegExp(username, 'i') },
          { username: new EscapedRegExp(email, 'i') },
          { username: new EscapedRegExp(username, 'i') }
        ]
      }
    ]
  }

  if (currentUser?._id) {
    query['$and'].push({
      _id: { $ne: currentUser._id }
    })
  }

  const users = await app.models.users.user.find(query)
  if (users?.length > 0) {
    const user = users[0]
    if (
      user.email.toLowerCase() === email ||
      user.username.toLowerCase() === email
    ) {
      throw new ClientError('Email is already registered')
    }
    if (
      user.username.toLowerCase() === username ||
      user.email.toLowerCase() === username
    ) {
      throw new ClientError('Username is in use')
    }
  }
}

// check if username is taken
const usernameAvailable = async (app, username, currentUser = null) => {
  const query = {
    username: new EscapedRegExp(username, 'i')
  }

  if (currentUser?._id) {
    query._id = { $ne: currentUser._id }
  }

  const users = await app.models.users.user.find(query)
  if (Array.isArray(users) && users.length > 0) {
    throw new ClientError('Username is in use. Choose another')
  }

  //if (Array.isArray(users) && users.length > 0) {
  //  if (users.length > 1) {
  //    throw new ClientError('Username is in use.')
  //  }
  //  if (users.length === 1) {
  //    if () {
  //      if (currentUser._id.toString() !== users[0]._id.toString()) {
  //        throw new ClientError('Username is in use.')
  //      }
  //    } else {
  //      throw new ClientError('Username is in use.')
  //    }
  //  }
  //}
}

module.exports = { validateUserData, validUsername, isUserKeyAvailable, usernameAvailable }
