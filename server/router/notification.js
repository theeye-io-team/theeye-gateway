const express = require('express')
const logger = require('../logger')('router:notifications')
const moment = require('moment')
const CredentialsConstants = require('../constants/credentials')
const TopicsConstants = require('../constants/topics')

module.exports = (app) => {
  const router = express.Router()

  // create notification
  router.post('/', async (req, res, next) => {
    try {
      const event = req.body

      if (!event.id) {
        let err = new Error('id required')
        err.status = 400
        throw err
      }

      if (!event.data) {
        let err = new Error('%s|data required', event.id)
        err.status = 400
        throw err
      }

      if (!event.topic) {
        let err = new Error('%s|topic required', event.id)
        err.status = 400
        throw err
      }

      logger.debug('%s|event arrived. %s', event.id, event.topic)
      logger.data('%o', event)

      // dispatch original event to all clients
      app.service.notifications.sockets.send(event)

      // handler for generic generated events by topic  
      await createTopicEventNotifications(req, res)

      // application specific notifications
      await sendTaskEventNotification(req, res)

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

  const sendTaskEventNotification = async (req, res) => {
    const event = req.body

    // can't send task event notifications without a task ...
    if ( ! (event.data.model && event.data.model.task) ) {
      logger.debug('%s|not a task notification', event.id)
      return
    }

    if (isTaskNotificationEvent(event)) {
      await createTaskCustomNotification(req, res)
    } else if (isResultNotificationEvent(event)){
      await createTaskResultNotification(req, res)
    }

    return
  }

  const createTaskResultNotification = async (req, res) => {
    const event = req.body
    const organization = event.data.organization
    const organization_id = event.data.organization_id
    const model = event.data.model

    let user_id
    if (model.workflow_job) {
      user_id = model.workflow_job.user_id
    } else {
      user_id = model.user_id
    }

    let user = await app.models.users.uiUser.findOne({ _id: user_id })
    if (!user) {
      throw new Error('User not found')
    }

    return new Promise((resolve, reject) => {
      // falta filtrar notifications
      app.service.notifications.sockets.send({
        id: event.id,
        topic: TopicsConstants.JOB_RESULT_RENDER,
        data: {
          model: model,
          model_type: 'Job',
          user_id: user.id,
          organization,
          organization_id
        }
      }, err => {
        if (err) {
          logger.error('%s|%s', event.id, 'socket error')
          logger.error(err)
          reject(err)
        } else {
          logger.debug('%s|%s', event.id, 'by socket notified')
          resolve()
        }
      })
    })
  }

  /**
   *
   * custom notifications can be sent to any user registered in the eye
   *
   */
  const createTaskCustomNotification = async (req, res) => {
    const event = req.body
    const notifyJob = event.data.model
    const notifyTask = notifyJob.task
    const notificationTypes = notifyTask.notificationTypes
    const args = (notifyJob.task_arguments_values || [])

    let subject = (args[0] || notifyTask.subject)
    let body = (args[1] || notifyTask.body)
    let recipients = (parseRecipients(args[2]) || notifyTask.recipients)
    let organization = event.data.organization
    let organization_id = event.data.organization_id

    logger.debug('%s|%s', event.id, 'dispatching custom notifications')

    let users = await getUsersToNotify(null, null, recipients, [])

    if (users.length === 0) {
      logger.debug('%s|%s', event.id, 'dismissed. no system users to notify')
      return 
    }

    event.data.notification = { subject, body, recipients }

    //createNotifications(event, users, event.data.organization, (err, notifications) => {})
    if (!notificationTypes || notificationTypes.desktop) {
      createNotifications({
        topic: TopicsConstants.NOTIFICATION_TASK,
        data: event.data,
        event_id: event.id,
        customer_name: organization,
        customer_id: organization_id,
        customer: organization_id
      }, users).then(notifications => {
        if (notifications) {
          // send extra notification event via socket to desktop clients
          logger.debug('%s|%s', event.id, 'creating desktop notifications')
          for (let index in notifications) {
            const notification = notifications[index]
            app.service.notifications.sockets.send({
              id: event.id,
              topic: TopicsConstants.NOTIFICATION_CRUD,
              data: {
                model: notification,
                model_type: 'Notification',
                user_id: notification.user_id,
                operation: 'create',
                organization,
                organization_id
              }
            })
            logger.debug('%s|%s', event.id, 'by desktop notified')
          }
        }
      })
    }

    // If notifications are not filtered, send all types as default
    if (!notificationTypes || notificationTypes.push) {
      for (let user of users) {
        logger.debug(`${event.id}|sending push notification to user ${user._id}`)
        app.service.notifications.push.dispatch({ msg: subject }, user)
        logger.debug(`${event.id}|by push notified`)
      }
    }

    if (!notificationTypes || notificationTypes.email) {
      for (let user of users) {
        app.service.notifications.email.send({ subject, body }, user.email)
        logger.debug('%s|%s', event.id, 'by email notified')
      }
    }

    logger.debug('%s|%s', event.id, 'custome notifications dispatched')
  }

  const parseRecipients = (emails) => {
    let recipients = null
    if (!emails) { return recipients }
    if (typeof emails === 'string') {
      emails = emails.toLowerCase()
      try {
        let values = JSON.parse(emails)
        if (Array.isArray(values) && values.length > 0) {
          recipients = values
        } else {
          throw new Error('invalid recipients format')
        }
      } catch (e) {
        logger.error(e)
        recipients = [emails]
      }
    }
    return recipients
  }

  /*
   *
   * events belong to organization/customers
   *
   * should only be notified to the organization members
   *
   */
  const createTopicEventNotifications = async (req, res) => {
    const event = req.body
    const topic = event.topic

    logger.debug('%s|dispatching event notification.', event.id)

    if (!isHandledNotificationEvent(event)) {
      logger.debug('%s|dismissed. not handled', event.id)
      return
    }

    let model = event.data.model
    let acls = (model.task ? model.task.acl : model.acl) || []
    let credentials = [
      CredentialsConstants.ROOT,
      CredentialsConstants.ADMIN,
      CredentialsConstants.OWNER
    ]
    let organization = event.data.organization
    let organization_id = event.data.organization_id

    let members = await getMembersToNotify(event, organization_id, acls, credentials)

    if (members.length === 0) {
      logger.debug('%s|%s', event.id, 'dismissed. no organization members to notify')
      return
    }

    if (!isApprovalOnHoldEvent(event)) {
      members = applyMembersNotificationFilters(event, members)
      // filtered members will not be notified at all
      if (!members || !Array.isArray(members) || members.length === 0) {
        logger.debug(`${event.id}|dismissed. notification is ignored by users`)
        return
      }
    }

    let users = members.map(member => member.user)

    // create a notification for each user
    createNotifications({
      topic: event.topic,
      data: event.data,
      event_id: event.id,
      customer_name: organization,
      customer_id: organization_id,
      customer: organization_id
    }, users).then(notifications => {
      //
      // notifications panel.
      // send notification-crud event via socket to ui clients
      //
      if (notifications.length > 0) {
        for (let index in notifications) {
          const notification = notifications[index]
          app.service.notifications.sockets.send({
            id: event.id,
            topic: TopicsConstants.NOTIFICATION_CRUD,
            data: {
              model: notification,
              model_type: 'Notification',
              user_id: notification.user_id,
              operation: 'create',
              organization,
              organization_id
            }
          })
          logger.debug('%s|%s', event.id, 'by socket notified')
        }
      }
    })

    sendMembersEmailNotification(event, members)

    for (let user of users) {
      logger.debug(`${event.id}|sending push notification to user ${user._id}`)
      app.service.notifications.push.dispatch(event, user)
      logger.debug(`${event.id}|by push notified`)
    }

    logger.debug(`${event.id}|event notifications dispatched`)
  }

  const handledTopics = [
    TopicsConstants.MONITOR_STATE,
    TopicsConstants.JOB_CRUD,
    TopicsConstants.JOB_SCHEDULER_CRUD,
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

  // Returns a user collection for a given customer
  const getUsersToNotify = async (event, customerName, acls, credentials) => {
    var query = {}

    if (event && isApprovalOnHoldEvent(event)) {
      query = {
        id: { $in: event.data.approvers }
      }
    } else {
      query = {
        username: { $ne: null },
        email: { $ne: null },
        enabled: true,
        $or: [ ]
      }

      if (Array.isArray(credentials) && credentials.length > 0) {
        query.$or.push({ credential: { $in: credentials } })
      }

      if (Array.isArray(acls) && acls.length > 0) {
        query.$or.push({ email: { $in: acls } })
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

  // Returns a members collection for a given customer
  const getMembersToNotify = async (event, customer_id, emails, credentials) => {
    var query = {}

    if (event && isApprovalOnHoldEvent(event)) {
      query = {
        user_id: { $in: event.data.approvers }
      }
    } else {
      query = { customer_id }
      if (Array.isArray(credentials) && credentials.length > 0) {
        query.credential = { $in: credentials }
      }
    }

    let members = await app.models.member
      .find(query)
      .populate({
        path: 'user',
        select: 'email username enabled credential devices'
      })
      .exec()

    if (!members || !Array.isArray(members) || members.length === 0) {
      return []
    }

    members = members.filter(member => {
      let user = member.user
      return (user.username && user.email && user.enabled === true)
    })
    return members
  }

  /**
   * @return {Promise}
   */
  const createNotifications = async (event, users) => {
    // Persist notifications
    // rulez for updates stopped/updates started.
    // only create notification for host
    const notifications = []

    users.forEach(user => {
      notifications.push(Object.assign({}, event, { user_id: user._id, user: user._id }))
    })

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

  const applyMembersNotificationFilters = (event, members) => {
    let filtered = []
    for (let member of members) {
      let excludes = (member.notifications && member.notifications.notificationFilters) || []
      let exclusionFilter
      if (excludes && Array.isArray(excludes) && excludes.length > 0) {
        exclusionFilter = excludes.find(exc => hasMatchedExclusionFilter(exc, event))
      }
      if (exclusionFilter === undefined) {
        filtered.push(member)
      }
    }
    return filtered
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

  const isTaskNotificationEvent = (event) => {
    let itIs = (
      event.data.model_type === 'NotificationJob' &&
      event.data.operation === 'create'
    )
    return itIs
  }
  const isResultNotificationEvent = (event) => {
    if (event.topic !== 'job-crud') { return false }
    if (event.data.model.task.show_result !== true) { return false }
    return isCompleted(event.data.model.lifecycle)
  }

  const sendMembersEmailNotification = (event, members) => {
    if (!event.data.subject || !event.data.body) {
      logger.error(`${event.id}|cannot send mail without subject and body`)
      logger.error(`${event.id}|${event} ${members}`)
      return
    }

    let message = {
      body: event.data.body,
      subject: event.data.subject
    }

    for (let member of members) {
      if (!member.user.email) {
        logger.error(`${event.id}|cannot send email to ${member.user._id}. address not set`)
      } else {
        if (member.notifications.mute !== true && member.notifications.email !== false) {
          // member user is ready to receive emails
          app.service.notifications.email
            .send(message, member.user.email)
            .then(response => {
              logger.debug(`${event.id}|mailer respose: ${response}`)
              logger.debug(`${event.id}|${member.user.email} notified`)
            })
            .catch(err => {
              logger.error(`${event.id}|mailer error: ${err}`)
            })
        }
      }
    }
  }

  return router
}
