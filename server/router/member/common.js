const logger = require('../../logger')('router:member:common')
const EscapedRegExp = require('../../escaped-regexp')
const { ClientError, ServerError } = require('../../errors')

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
          throw new ClientError('Customer not found.')
        }

        const user = await app.models.users.uiUser.findOne({
          email: new EscapedRegExp(context.email,'i')
        })

        let member
        if (!user) {
          const { user, member } = await newUserFlow(app, customer, context)

          if (req.notify_user === true) {
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
          }

        } else {
          const member = await existentUserFlow(app, customer, user, context)

          if (req.notify_user === true) {
            if (user.enabled !== true) {
              // resent user activation email
              user.invitation_token = app.service
                .authentication
                .issue({ email: user.email })

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
          }
        }

        return res.status(200).json(member)
      } catch (err) {
        next(err)
      }
    },
    async createExistentUserMember (req, res, next) {
      try {
        const context = req.context

        const customer = await app.models.customer.findById(context.customer_id)
        if (!customer) {
          throw new ClientError('Customer not found.')
        }

        const user = await app.models.users.uiUser.findOne({
          email: new EscapedRegExp(context.email,'i')
        })

        if (!user) {
          throw new ClientError('User not found.')
        }

        let member = await app.models.member.findOne({
          user_id: user._id,
          customer_id: customer._id
        })

        if (member) {
          // member exists and user is activated. nothing to do
          throw new ClientError('Member already activated', { code: 'AlreadyActiveMember' })
        }

        const data = {
          user: user._id,
          user_id: user._id,
          customer: customer._id,
          customer_id: customer._id,
          customer_name: customer.name,
          credential: context.credential
        }

        member = await app.models.member.create(data)
        member.user = user

        return res.status(200).json(member)
      } catch (err) {
        next(err)
      }
    }
  }

  const newUserFlow = async (app, customer, context) => {
    const email = context.email.toLowerCase()

    // si el usuario no existe, creo un nuevo
    const user = await app.models.users.uiUser.create({
      email,
      username: email,
      name: context.name,
      enabled: false,
      invitation_token: app.service.authentication.issue({ email })
    })

    // creo el member para el nuevo user
    const member = await app.models.member.create({
      user: user._id,
      user_id: user.id,
      customer: customer._id,
      customer_id: customer._id,
      customer_name: customer.name,
      credential: context.credential,
      tags: context.tags
    })

    member.user = user

    return { user, member }
  }

  const existentUserFlow = async (app, customer, user, context) => {
    // check if is already member
    let member = await app.models.member.findOne({
      user_id: user._id,
      customer_id: customer._id
    })

    if (member && user.enabled) {
      // member exists and user is activated. nothing to do
      throw new ClientError('Member already activated', { code: 'AlreadyActiveMember' })
    }

    if (!member) {
      data = {
        user: user._id,
        user_id: user._id,
        customer: customer._id,
        customer_id: customer._id,
        customer_name: customer.name,
        credential: context.credential,
        tags: context.tags
      }

      member = await app.models.member.create(data)
      member.user = user
    }

    return member
  }

  return handlers
}
