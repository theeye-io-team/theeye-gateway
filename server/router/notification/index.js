const moment = require('moment')
const express = require('express')
const isEmail = require('validator/lib/isEmail')

const logger = require('../../logger')('router:notifications')
const CredentialsConstants = require('../../constants/credentials')
const TopicsConstants = require('../../constants/topics')
const { ClientError, ServerError } = require('../../errors')
const EscapedRegExp = require('../../escaped-regexp')

module.exports = (app) => {
  const router = express.Router()

  // create notification
  router.post('/', async (req, res, next) => {
    try {
      const event = req.body
      if (!event.id) { throw new ClientError('id required') }
      if (!event.data) { throw new ClientError('event data required', event.id) }
      if (!event.topic) { throw new ClientError('event topic required', event.id) }

      logger.debug('%s|event arrived. %s', event.id, event.topic)
      logger.data('%o', event)

      const members = await getMembersToNotify(event)

      await Promise.all([
        // send event via redis pub/sub messages system
        app.service.notifications.messages.sendEvent(event),
        // handler for generically generated events by topic  
        createTopicEventNotifications(event, members),
        // handler for all generated events by organization/topic
        sendSocketEventByACL(event, members),
      ])

      return res.status(200).json('ok')
    } catch (err) {
      logger.error(err)
      if (err.status === 400) {
        return res.status(400).json({ message: err.message })
      } else {
        return res.status(500).json('Internal Server Error')
      }
    }
  })

  // notification maintenance
  router.delete(
    '/',
    (req, res, next) => {
      let date = moment()
        .subtract(1, 'days')
        .startOf('day')
        .toDate()

      app.models.notifications.deleteMany({
        creation_date: {
          $lte: date
        }
      }, function (err, result) {
        if (err) { return res.status(500).json({ message: 'Error removing notifications.' }) }
        res.json({ count: result })
      })
    }
  )

  router.post('/task', async (req, res, next) => {
    try {
      const event = req.body
      if (!event) {
        throw new ClientError('Invalid Event. Request body required')
      }

      createTaskNotification(event)
        .then(() => logger.log('task notification dispatched'))
        .catch(logger.error)

      return res.status(200).json('ok')
    } catch (err) {
      if (err.status) {
        res.status(err.status).json( { message: err.message })
      } else {
        logger.error(err)
        res.status(500).json('Internal Server Error')
      }
    }
  })

  const sendSocketEventByACL = async (event, members) => {
    const AdminCredentials = [
      CredentialsConstants.ROOT,
      CredentialsConstants.ADMIN,
      CredentialsConstants.OWNER
    ]

    // administrators channel
    app.service.notifications.sockets.sendEvent(event, 'admin')

    for (let order = 0; order < members.length; order++) {
      const member = members[order]
      // member is not admin
      // send messages to its own channel
      if (!AdminCredentials.includes(member.credential)) {
        app.service.notifications.sockets.sendEvent(event, member.user)
      }
    }
  }

  /**
   *
   * custom notifications can be sent to any user registered in the eye
   *
   */
  const createTaskNotification = async (event) => {
    const { subject, message, recipients, notificationTypes } = event.data

    logger.debug('%s|%s', event.id, 'sending custom notifications')

    let users = await getUsersToNotify(null, null, recipients, [])
    if (users.length === 0) {
      logger.debug('%s|%s', event.id, 'dismissed. no system users to notify')
      return 
    }

    event.data.notification = { subject, body: message, recipients }

    // If notifications are not filtered, send all types as default
    if (!notificationTypes || notificationTypes.desktop) {
      const payload = Object.assign({}, event, {
        topic: TopicsConstants.NOTIFICATION_TASK
      })
      createNotifications(payload, users)
    }

    if (!notificationTypes || notificationTypes.push) {
      for (let user of users) {
        logger.debug(`${event.id}|sending push notification to user ${user._id}`)
        app.service.notifications.push.send({ msg: subject }, user)
      }
    }

    if (!notificationTypes || notificationTypes.email) {
      for (let user of users) {
        const payload = { subject, body: message }
        if (event.data && event.data.organization) {
          payload.organization = event.data.organization || ''
        }
        app.service.notifications.email.send(payload, user.email)
          .then(() => {
            logger.debug('%s|%s', event.id, 'by email notified')
          })
          .catch(err => {
            logger.error(err)
            logger.error('%s|%s', event.id, err.message)
          })
      }
    }

    //logger.debug('%s|%s', event.id, 'custome notifications sent')
  }

  /*
   *
   * events belong to organization/customers
   *
   * should only be notified to the organization members
   *
   */
  const createTopicEventNotifications = async (event, members) => {

    if (members.length === 0) {
      logger.debug('%s|%s', event.id, 'no members to notify')
      return
    }

    if (!isHandledNotificationEvent(event)) {
      logger.debug('%s|dismissed. not handled', event.id)
      return
    }

    const filteredMembers = applyMemberNotificationFilters(event, members)
    if (filteredMembers.length === 0) {
      logger.debug('%s|dismissed. no one wants to receive it', event.id)
      return
    }

    logger.debug('%s|sending event notification.', event.id)

    const users = filteredMembers.map(member => member.user)

    // desktop notifications / bell
    createNotifications(event, users)

    // email notifications
    sendMembersEmailEvent(event, filteredMembers)

    // push notifications
    for (let user of users) {
      logger.debug(`${event.id}|sending push notification to user ${user._id}`)
      app.service.notifications.push.sendEvent(event, user)
      logger.debug(`${event.id}|by push notified`)
    }

    logger.debug(`${event.id}|${event.topic} notifications sent`)
  }

  const handledTopics = [
    TopicsConstants.MONITOR_STATE,
    TopicsConstants.JOB_CRUD,
    TopicsConstants.SCHEDULE_CRUD,
    TopicsConstants.WEBHOOK_TRIGGERED
  ]

  const isHandledNotificationEvent = (event) => {
    if (handledTopics.indexOf(event.topic) === -1) {
      return false
    }

    if (
      event.topic == TopicsConstants.MONITOR_STATE &&
      event.data.model.type !== 'host' &&
      (
        event.data.monitor_event == 'updates_stopped' ||
        event.data.monitor_event == 'updates_started'
      )
    ) {
      return false
    }

    return true
  }

  // Returns a users collection for the given customer
  const getUsersToNotify = async (
    event,
    customerName,
    ids = [],
    credentials = []
  ) => {
    let query = {}

    if (event && isApprovalOnHoldEvent(event)) {
      const approvers = event.data.model?.approvers
      query = {
        id: { $in: approvers }
      }
    } else {
      /**
       * ABORT !
       */
      if (
        (!Array.isArray(ids) || ids.length === 0) &&
        (!Array.isArray(credentials) || credentials.length === 0)
      ) {
        return []
      }

      query = {
        username: { $ne: null },
        email: { $ne: null },
        enabled: true,
        $or: [ ]
      }

      if (Array.isArray(credentials) && credentials.length > 0) {
        query.$or.push({ credential: { $in: credentials } })
      }

      if (Array.isArray(ids) && ids.length > 0) {
        // casi insensitive search
        const ciIds = ids
          .filter(id => typeof id === 'string')
          .map(id => new EscapedRegExp(id, 'i'))

        query.$or.push({ email: { $in: ciIds } })
        query.$or.push({ username: { $in: ciIds } })
      }

      if (customerName) {
        query.customers = customerName
      }
    }

    let users = await app.models.users.uiUser.find(query)
    if (!users || !Array.isArray(users) || users.length === 0) {
      return []
    }
    return users
  }

  const getMembersToNotify = async (event) => {
    const model = event.data.model
    const query = {
      disabled: { $ne: true },
      customer_id: event.data.organization_id,
      credential: {
        $nin: [
          CredentialsConstants.AGENT,
          CredentialsConstants.INTEGRATION,
        ]
      }
    }

    // get members of the organization
    const members = await app.models.member
      .find(query)
      .populate({
        path: 'user',
        match: {
          enabled: true,
          email: { $ne: '', $ne: null }
        },
        select: 'email username enabled credential devices'
      })
      .exec()

    if (members.length === 0) {
      return []
    }

    const acl = {
      identifiers: [],
      roles: [
        CredentialsConstants.ROOT,
        CredentialsConstants.ADMIN,
        CredentialsConstants.OWNER
      ],
      tags: []
    }

    // prepare model acl
    if (model && model.acl?.length > 0) {
      for (let order = 0; order < model.acl.length; order++) {
        const value = model.acl[order]

        if (CredentialsConstants.LIST.indexOf(value) !== -1) {
          // the acl is a credential
          acl.roles.push(value)
        } else if (isTagAcl(value)) {
          // the acl is a k:v tag
          acl.tags.push(value)
        //} else if (isEmail(value)) {
        } else {
          // the acl is an identifier
          acl.identifiers.push(value)
        }
      }
    }

    const toNotify = []
    for (let order = 0; order < members.length; order++) {
      const member = members[order]
      if (!member.user) {
        logger.error('member user does not exists %s', member._id)
        member.disabled = true
        member.save().then(() => {
          logger.error('member automatically disabled')
        })
      } else if (memberHasAccess(member, acl)) {
        toNotify.push(member)
      }
    }
    return toNotify
  }

  const memberHasAccess = (member, acl) => {
    let found = false

    // by credential
    if (acl.roles.indexOf(member.credential) !== -1) { return true }

    // by key:value tags
    found = member.tags
      .find(mTag => acl.tags.includes(`${mTag.k}:${mTag.v}`))

    if (found) { return true }

    // by user email
    return acl.identifiers.includes(member.user.email)
  }

  const applyMemberNotificationFilters = (event, members) => {
    const toNotify = []
    for (let index = 0; index < members.length; index++) {
      const member = members[index]

      // approval tasks Approvers must be notified
      if (isApprovalOnHoldEvent(event)) {
        const approvers = event.data.model?.approvers
        for (let i = 0; i < approvers.length; i++) {
          if (member.user_id.toString() === approvers[i]) {
            toNotify.push(member)
            break
          }
        }
      } else if (!isFilteredByMember(event, member)) {
        toNotify.push(member)
      }
    }
    return toNotify
  }

  const isFilteredByMember = (event, member) => {
    const filters = member.notifications?.notificationFilters || []
    let filtered = false
    if (!Array.isArray(filters) || filters.length === 0) {
      // not filtes
      return false
    }

    return filters.find(f => hasMatchedExclusionFilter(f, event)) !== undefined
  }

  /**
   *
   * @summary all filters within the same group should match to match the whole filter.
   * @prop {Object} filter an object with exclusion filter data
   * @prop {Object} event the notification event information (with data and topic)
   * @return true if any filter match
   *
   */
  const hasMatchedExclusionFilter = (filter, event) => {
    // every string prop value has to match
    let matchedProps = []
    let matchedData = []
    let hasMatches

    // look for matches in props
    for (let prop in filter) {
      if (canCompare(filter[prop], event[prop])) {
        matchedProps.push(filter[prop] === event[prop])
      }
    }

    // if no matched every level 1 properties, then break
    if (matchedProps.length>0) {
      hasMatches = matchedProps.every(match => match === true)
      if (hasMatches===false) { return false }
    }

    // look for matches in data prop
    if (filter.hasOwnProperty('data')) {
      for (let prop in filter.data) {
        if (canCompare(filter.data[prop], event.data[prop])) {
          matchedData.push(filter.data[prop] === event.data[prop])
        }
      }
    }

    if (matchedData.length>0) {
      hasMatches = matchedData.every(match => match === true)
      if (hasMatches===false) { return false }
    }

    return true
  }

  /**
   * @summary can compare same valid comparable types
   * @param {*} val1
   * @param {*} val2
   * @return {Boolean}
   */
  const canCompare = (val1, val2) => {
    const isComparable = (value) => {
      // we can compare types and null
      let types = ['number','string','boolean','undefined']
      let type = typeof value
      return types.indexOf(type) !== -1 || value === null
    }

    if (isComparable(val1) && isComparable(val2)) {
      return (typeof val1 === typeof val2)
    } else {
      return false
    }
  }

  /**
   *
   * create notification in DB is disabled.
   *
   * send the model via socket.
   *
   */
  const createNotifications = (event, users) => {
    const props = {
      topic: event.topic,
      data: event.data,
      event_id: event.id,
      customer_name: event.data.organization,
      customer_id: event.data.organization_id,
      customer: event.data.organization_id
    }

    return insertNotifications(props, users)
      .then(notifications => {
        // notifications panel.
        // send notification-crud event via socket to ui clients
        if (notifications.length > 0) {
          logger.debug('%s|%s', event.id, 'creating desktop notifications')
          for (let index = 0; index < notifications.length; index++) {
            const notification = notifications[index]
            app.service.notifications.sockets.sendEvent({
              id: event.id,
              topic: TopicsConstants.NOTIFICATION_CRUD,
              data: {
                model: notification,
                model_type: 'Notification',
                user_id: notification.user_id,
                operation: 'create',
                organization: event.data.organization,
                organization_id: event.data.organization_id
              }
            })
            logger.debug('%s|%s', event.id, 'by socket notified')
          }
        }
      })
      .catch(logger.error)
  }

  const insertNotifications = async (event, users) => {
    // Persist notifications
    // rulez for updates stopped/updates started.
    // only create notification for host
    const notifications = []

    for (let index = 0; index < users.length; index++) {
      const user = users[index]
      notifications.push(
        Object.assign({}, event, { user_id: user._id, user: user._id })
      )
    }

    //return app.models.notification.create(notifications)

    // temp disable notifications in database
    // create model but dont save it to database
    let models = []
    for (let notification of notifications) {
      models.push(new app.models.notification(notification))
    }
    return models
  }

  /**
   * @summary ...
   * @param {Object} event
   * @return {Boolean}
   */
  const isApprovalOnHoldEvent = (event) => {
    let isEvent = (
      event.topic === 'job-crud' &&
      event.data.model_type === 'ApprovalJob' &&
      event.data.model.lifecycle === 'onhold'
    )

    return isEvent
  }

  const isCompleted = (lifecycle) => {
    let completed = [
      'canceled',
      'completed',
      'finished',
      'expired', // take to much time to complete
      'terminated' // abruptly
    ].indexOf(lifecycle) !== -1

    return completed
  }

  const sendMembersEmailEvent = (event, members) => {
    for (let member of members) {
      if (
        member.notifications.mute !== true &&
        member.notifications.email !== false
      ) {
        // try to deliver emails to the user
        const user = member.user
        app.service.notifications.email
          .sendEvent(event, user)
          .then(response => {
            logger.debug(`${event.id}|mail service response: %j`, response)
            logger.debug(`${event.id}|${user.email} notified`)
          })
          .catch(err => {
            let org = (event.data && event.data.organization)
            logger.error(`${event.id}|${event.topic}|${org} mail service error: ${err}`)
          })
      }
    }
  }

  const isTagAcl = (value) => {
    return value.trim().split(':').length === 2
  }

  return router
}
