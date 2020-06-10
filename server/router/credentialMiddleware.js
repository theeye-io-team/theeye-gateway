const CredentialsConstants = require('../constants/credentials')

module.exports = {
  check: (requiredCredentials) => {
    return (req, res, next) => {
      const checkCredentials = (credential, accepted) => {
        return (accepted.indexOf(credential) !== -1)
      }

      let hasAccessLevel= checkCredentials(req.session.credential, requiredCredentials)
      if (!hasAccessLevel) {
          return res.status(403).json('Forbidden')
      }
      return next()
    }
  },
  root: () => {
    return (req, res, next) => {
      if (req.session.credential !== CredentialsConstants.ROOT) {
        return res.status(403).json('Forbidden')
      }
      return next()
    }
  }
}
