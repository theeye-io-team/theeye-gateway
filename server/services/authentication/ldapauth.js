const logger = require('../../logger')(':services:authentication:ldapauth')

module.exports = (app) => {
  const ldapConfig = app.config.services.authentication.strategies.ldapauth

  return async function (req, ldapProfile, next) {
    try {
      if (!ldapConfig.fields || !ldapConfig.provider || !ldapConfig.customerName) {
        let err = new Error('LDAP config is not set correctly.')
        err.status = 500
        err.ldap_config = ldapConfig
        throw err
      }

      if (!ldapProfile[ldapConfig.fields.username] || !ldapProfile[ldapConfig.fields.email]) {
        let err = new Error('Missing LDAP Profile values.')
        err.status = 500
        err.ldap_profile = ldapProfile
        throw err
      }

      // verificar customer
      let customer = await app.models.customer.findOne({ name: ldapConfig.customerName })
      if (!customer) {
        let err = new Error('LDAP default organization not found.')
        err.status = 500
        logger.error(err)
        return next(err)
      }

      let profile = parseProfile(ldapProfile)

      let user = await app.models.users.uiUser.findOne({ 
        $or: [
          { email: profile.email },
          { username: profile.username }
        ]
      })

      if (!user) {
        user = await app.models.users.uiUser.create({
          username: profile.username,
          email: profile.email,
          name: profile.name,
          credential: profile.credential,
          enabled: true,
          invitation_token: null,
          devices: null,
          notifications: null ,
          onboardingCompleted: false
        })
      }

      let member = await app.models.member.findOne({
        user_id: user._id,
        customer_id: customer._id
      })

      if (!member) {
        await app.models.member.create({
          user: user._id,
          user_id: user._id,
          customer: customer._id,
          customer_id:  customer._id,
          customer_name: customer.name,
          credential: profile.credential
        })
      }

      let provider = ldapConfig.provider
      let identifier = profile[ldapConfig.fields.id]
      let passport = await app.models.passport.findOne({
        protocol: 'ldap',
        provider: provider,
        user_id: user._id
      })

      if (!passport) {
        passport = await app.models.passport.create({
          protocol: 'ldap',
          provider: provider,
          identifer: identifier,
          user: user._id,
          user_id: user._id
        })
      }

      logger.log('User %s authenticated via LDAP strategy.', user.username)
      return next(null, { user, passport })
    } catch (err) {
      logger.error(err)
      if (err.status === 404) {
        unauthorized(next)
      }
    }
  }

  const unauthorized = (next) => {
    let err = new Error('Unauthorized')
    err.statusCode = 401
    next && next(err, false)
    return err
  }

  const parseProfile = (profile) => {
    let data = {
      username: profile[ldapConfig.fields.username],
      name: profile[ldapConfig.fields.name],
      email: profile[ldapConfig.fields.email],
      customerName: [ldapConfig.customerName],
      credential: getUserCredential(profile[ldapConfig.fields.groups]),
      enabled: true
    }
    return data
  }

  const getUserCredential = (groups) => {
    if (/theeye_owners/i.test(groups)) {
      return 'owner'
    } else if (/theeye_admins/i.test(groups)) {
      return 'admin'
    } else if (/theeye_managers/i.test(groups)) {
      return 'manager'
    } else if (/theeye_users/i.test(groups)) {
      return 'user'
    } else if (/theeye/i.test(groups)) {
      return 'viewer'
    } else {
      let err = new Error('user not in theeye group')
      err.status = 404
      err.ldap_groups = groups
      throw err
    }
  }
}
