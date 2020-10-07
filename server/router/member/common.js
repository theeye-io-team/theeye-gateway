const logger = require('../../logger')('router:member:common')
const emailTemplates = require('../../services/notifications/email/templates')

module.exports = function (app) {
  const handlers = {
    async fetch (req, res, next) {
      try {
        let dbQuery = req.db_query
        let members = await app.models.member.find(dbQuery).exec()

        for (var member of members) {
          await member.populate({
            path: 'user',
            select: 'id name username email enabled'
          }).execPopulate()
        }

        res.json(members)
      } catch (err) {
        next(err)
      }
    },
    async create (req, res, next) {
      try {
        const context = req.context
        const data = {}

        const customer = await app.models.customer.findById(context.customer_id)
        if (!customer) {
          const err = Error('Customer not found.')
          err.status = 400
          throw err
        }

        const user = await app.models.users.uiUser.findOne({ email: context.email })
        let member
        if (!user) {
          member = await inviteNewUser(app, customer, context)
        } else {
          member = await inviteExistentUser(app, customer, user, context)
        }

        return res.status(200).json(member)
      } catch (err) {
        next(err)
      }
    }
  }

  const inviteNewUser = async (app, customer, context) => {
    // si el usuario no existe, creo un nuevo
    let token = app.service.authentication.issue({ email: context.email })

    let userData = {
      username: context.email,
      name: context.name,
      email: context.email,
      enabled: false,
      invitation_token: token
    }

    let user = await app.models.users.uiUser.create(userData)

    // creo el member para el nuevo user
    let memberData = {
      user: user._id,
      user_id: user.id,
      customer: customer._id,
      customer_id: customer._id,
      customer_name: customer.name,
      credential: context.credential
    }

    let member = await app.models.member.create(memberData)
    member.user = user

    await sendActivationEMail(app, {
      name: user.name,
      email: user.email,
      customer_name: customer.name,
      activation_link: getActivationLink(user.invitation_token, app.config.activateUrl)
    })

    await sendCustomerInvitationEMail(app, {
      name: user.name,
      email: user.email, 
      customer_name: customer.name
    })

    return member
  }

  const inviteExistentUser = async (app, customer, user, context) => {
    // check if is already member
    let member = await app.models.member.findOne({
      user_id: user._id,
      customer_id: customer._id
    })

    if (member && user.enabled) {
      // member exists and user is activated. nothing to do
      let err = new Error('Member already activated')
      err.code = 'AlreadyActiveMember'
      err.status = 400
      throw err
    }

    if (!member) {
      data = {
        user: user._id,
        user_id: user._id,
        customer: customer._id,
        customer_id: customer._id,
        customer_name: customer.name,
        credential: context.credential
      }

      member = await app.models.member.create(data)
      member.user = user
    }

    if (user.enabled !== true) {
      // resent user activation email
      let token = app.service.authentication.issue({ email: user.email })
      user.invitation_token = token
      await user.save()
      member.user = user

      await sendActivationEMail(app, {
        name: user.name,
        email: user.email,
        customer_name: customer.name,
        activation_link: getActivationLink(user.invitation_token, app.config.activateUrl)
      })
    }

    // resend customer invitation
    await sendCustomerInvitationEMail(app, {
      name: user.name,
      email: user.email, 
      customer_name: customer.name
    })

    return member
  }

  const getActivationLink = (invitation_token, activateUrl) => {
    if (app.config.services.authentication.strategies.ldapauth) {
      return app.config.app.base_url + '/login'
    }

    let params = JSON.stringify({ invitation_token })
    let query = Buffer.from(params).toString('base64')
    return (activateUrl + query)
  }

  /**
   * @return {Promise}
   */
  const sendActivationEMail = (app, data) => {
    let options = {
      subject: 'TheEye Account Activation',
      body: emailTemplates.activation(data)
    }

    return app.service.notifications.email.send(options, data.email)
  }

  /**
   * @return {Promise}
   */
  const sendCustomerInvitationEMail = (app, data) => {
    let options = {
      subject: 'TheEye Invitation',
      body: emailTemplates.customerInvitation(data)
    }

    return app.service.notifications.email.send(options, data.email)
  }

  return handlers
}
