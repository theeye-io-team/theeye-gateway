const logger = require('../../logger')(':services:authentication:ldapauth')
const { ClientError, ServerError } = require('../../errors')

const PROTOCOL = 'ldap'

const CREDENTIALS_MAP = {}
CREDENTIALS_MAP['theeye_owners'] = 'owner'
CREDENTIALS_MAP['theeye_admins'] = 'admin'
CREDENTIALS_MAP['theeye_managers'] = 'manager'
CREDENTIALS_MAP['theeye_editors'] = 'editor'
CREDENTIALS_MAP['theeye_users'] = 'user'
CREDENTIALS_MAP['theeye_viewers'] = 'viewer'
CREDENTIALS_MAP['theeye_agents'] = 'agent'
CREDENTIALS_MAP['theeye_integrations'] = 'integration'

module.exports = async (app) => {
  const ldapConfig = app.config.services.authentication.strategies.ldapauth

  if (!ldapConfig.fields) {
    throw new Error('LDAP config fields are not set correctly.')
  }

  if (ldapConfig.passReqToCallback === true) {
    logger.error('handler is not prepared to use req argument.')
    logger.error('config ldapauth.passReqToCallback must be removed')
    throw new Error('passport-ldap unsupport configuration set: passReqToCallback')
  }

  const handleProfile = async (ldapProfile) => {
    logger.data('user authenticated. profile found %o', ldapProfile)

    if (
      ! ldapProfile[ldapConfig.fields.username] ||
      ! ldapProfile[ldapConfig.fields.email]
    ) {
      throw new ServerError('Missing LDAP Profile values.', { data: ldapProfile })
    }

    const profile = buildProfile(ldapProfile)
    const user = await handleUserProfile(profile)
    const passport = await handleUserPassport({ user, profile })

    const member = await handleUserMembers({ user, profile })

    logger.log('User %s authenticated via LDAP strategy.', user.username)
    return { user, passport }
  }

  const unauthorized = () => {
    let err = new Error('Unauthorized')
    err.statusCode = 401
    return err
  }

  const buildProfile = (profile) => {
    let email
    if (Array.isArray(profile[ldapConfig.fields.email])) {
      email = profile[ldapConfig.fields.email][0]
    } else {
      email = profile[ldapConfig.fields.email]
    }

    let name
    if (Array.isArray(profile[ldapConfig.fields.name])) {
      name = profile[ldapConfig.fields.name].join(' ')
    } else {
      name = profile[ldapConfig.fields.name]
    }

    const data = {
      name,
      email,
      identifier: profile[ldapConfig.fields.id],
      username: profile[ldapConfig.fields.username],
      credential: getUserCredential(profile[ldapConfig.fields.groups]),
      enabled: true
    }

    return data
  }

  /**
   * @param {Array} groups
   * @return {String}
   */
  const getUserCredential = (groups) => {
    let matches = []
    for (let group of groups) {
      if (/theeye_/i.test(group) === true) {
        matches.push(group)
      }
    }

    if (matches.length === 0) {
      if (!ldapConfig.defaultGroup) {
        throw new ClientError('Domain access rejected. Not in TheEye Group', { statusCode: 403 })
      }

      return CREDENTIALS_MAP[ldapConfig.defaultGroup]
    }

    let group = CREDENTIALS_MAP[ matches[0] ]
    if (group === undefined) {
      throw new ClientError(`Domain access rejected. Invalid TheEye Group ${matches[0]}`, { statusCode: 403 })
    }

    logger.log(`user is in group ${group}`)
    return group
  }

  /**
   * @param {Object} profile ldap profile
   * @return {Promise<User>}
   */
  const handleUserProfile = async (profile) => {
    const user = await app.models.users.uiUser.findOne({
      $or: [
        { email: profile.email },
        { username: profile.username }
      ]
    })

    if (!user) {
      // create new user
      const userCreatePromise = app.models.users.uiUser.create({
        username: profile.username,
        email: profile.email,
        name: profile.name,
        enabled: true,
        onboardingCompleted: false,
        invitation_token: null,
        devices: null,
        notifications: null
      })

      return userCreatePromise
    } else {
      // update user profile
      user.enabled = true
      user.invitation_token = null
      user.username = profile.username
      user.email = profile.email
      user.name = profile.name
      return user.save()
    }
  }

  /**
   *
   * @param {Input}
   * @prop {User} user
   * @prop {Object} profile ldap profile
   *
   * @return {Promise}
   *
   */
  const handleUserMembers = async ({ user, profile }) => {
    const member = await app.models.member.findOne({ user_id: user._id })

    if (!member) {
      if (!ldapConfig.defaultCustomerName) {
        throw new ClientError('Domain access rejected. Not assigned organization', { statusCode: 403 })
      }

      // verificar default customer
      let customer = await app.models.customer.findOne({ name: ldapConfig.defaultCustomerName })
      if (!customer) {
        customer = await app.models.customer.create({ name: ldapConfig.defaultCustomerName })
      }

      // create default member
      const memberCreatePromise = app.models.member.create({
        user: user._id,
        user_id: user._id,
        customer: customer._id,
        customer_id:  customer._id,
        customer_name: customer.name,
        credential: profile.credential
      })
      return memberCreatePromise
    }

    return member
  }

  /**
   *
   * @param {Input}
   * @prop {User} user
   * @prop {Object} profile ldap profile
   *
   * @return {Promise}
   *
   */
  const handleUserPassport = async ({ user, profile }) => {
    const provider = ldapConfig.provider || 'ldap'
    const identifier = profile.identifier

    const ldapPassport = await app.models.passport.findOne({
      protocol: PROTOCOL,
      provider,
      user_id: user._id
    })

    if (!ldapPassport) {
      const passportCreatePromise = app.models.passport.create({
        protocol: PROTOCOL,
        provider,
        identifier,
        user: user._id,
        user_id: user._id
      })
      return passportCreatePromise
    } else {
      if (ldapPassport.identifier !== identifier) {
        ldapPassport.identifier = identifier
        return ldapPassport.save()
      }

      return ldapPassport
    }
  }

  const handler = (ldapProfile, next) => {
    handleProfile(ldapProfile)
      .then(profile => {
        return next(null, profile)
      })
      .catch(err => {
        logger.error(err)
        if (err.status === 404) {
          next(unauthorized())
        } else {
          next(err)
        }
      })
  }

  return handler
}
