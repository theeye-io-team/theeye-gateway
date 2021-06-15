const logger = require('../../logger')('router:member:common')
const EscapedRegExp = require('../../escaped-regexp')

module.exports = function (app) {
  const handlers = {
    async fetch (req, res, next) {
      try {
        let dbQuery = req.db_query
        let members = await app.models.member.find(dbQuery).exec()

        for (let member of members) {
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

        const user = await app.models.users.uiUser.findOne({
          email: new EscapedRegExp(context.email,'i')
        })

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
    const userData = {
      username: context.email,
      name: context.name,
      email: context.email,
      enabled: false,
      invitation_token: app.service.authentication.issue({ email: context.email })
    }

    const user = await app.models.users.uiUser.create(userData)

    // creo el member para el nuevo user
    const memberData = {
      user: user._id,
      user_id: user.id,
      customer: customer._id,
      customer_id: customer._id,
      customer_name: customer.name,
      credential: context.credential
    }

    const member = await app.models.member.create(memberData)
    member.user = user

    await app.service
      .notifications
      .email
      .sendActivationMessage({ user })

    await app.service
      .notifications
      .email
      .sendCustomerInvitationMessage({
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
      user.invitation_token = app.service.authentication.issue({ email: user.email })

      await app.service
        .notifications
        .email
        .sendActivationMessage({ user })

      await user.save()
      member.user = user
    }

    // resend customer invitation
    await app.service
      .notifications
      .email
      .sendCustomerInvitationMessage({
        name: user.name,
        email: user.email,
        customer_name: customer.name
      })

    return member
  }

  return handlers
}
