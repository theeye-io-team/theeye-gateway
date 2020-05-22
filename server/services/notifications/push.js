const app = require('../../app')
const logger = require('../../logger')('service:notifications:push')
const fs = require('fs')
const TopicsConstants = require('../../constants/topics')

class Push {

  constructor (app, config) {
    this.config = config
  }

  send (event, user) {
    const model = event.data.model
    let data
    switch (event.topic) {
      case TopicsConstants.MONITOR_STATE:
        let monitor_event = event.data.monitor_event
        let severity = model.failure_severity

        if (severity === 'HIGH' || severity === 'CRITICAL') {
          data = prepareMonitorStateChangeNotification(model, monitor_event)
          if (data.msg) this.dispatch(data, user)
        }
        break
      case TopicsConstants.JOB_CRUD:
        data = prepareJobNotification(model)
        if (data.msg) this.dispatch(data, user)
        break
      case TopicsConstants.WEBHOOK_TRIGGERED:
        data = prepareWebhookNotification(model)
        if (data.msg) this.dispatch(data, user)
        break
      default:
        logger.debug('topic not handled')
    }
  }

  dispatch (data, user) {
    if (!user.devices) {
      return logger.log(`${user._id} no devices registered`)
    }

    if (!data.msg) {
      return logger.error('invalid message, undefined')
    }

    let message = data.msg.replace(/['"]+/g, '')
    let action = data.action || 'showNotificationsTab'
    let params = {
      MessageStructure: 'json',
      Message: JSON.stringify({
        "GCM": "{ \"data\": { \"message\": \"" + message + "\",  \"action\": \"" + action + "\", \"style\": \"inbox\", \"summaryText\": \"%n% New notifications\"} }",
        "APNS_SANDBOX": "{ \"aps\": { \"alert\": \"" + message + "\" } }",
        "APNS": "{ \"aps\": { \"alert\": \"" + message + "\" } }"
      })
    }

    user.devices.forEach( (device) => {
      params.TargetArn = device.endpoint_arn
      logger.debug('Sending notification to target arn: ' + params.TargetArn)

      app.sns.publish(params, (error, data) => {
        if (error) {
          logger.error('%o', error)
          logger.error('Error sending notification, deleting endpoint arn: ' + params.TargetArn)
          handleSNSError(user, device)
        } else {
          logger.debug('Push notification sent.')
        }
      })
    })

    if (this.config.debug) {
      dumpSNSMessage(`arn:user:${user.username}`, this.config.debug_filename, params)
    }
  }
}

module.exports = Push

const prepareJobNotification = (job) => {
  let data = {}
  switch (job._type) {
    case 'ApprovalJob':
      data = prepareApprovalJobNotification(job)
      break
    default:
      logger.log('job type %s not handled', job._type)
      break
  }
  return data
}

const prepareApprovalJobNotification = (job) => {
  let data = {}

  switch (job.lifecycle) {
    case 'onhold':
      data.msg = `Task ${job.task.name} needs approval.`
      data.action = 'approvalTasks'
      break
  }
  return data
}

const prepareMonitorStateChangeNotification = (monitor, monitor_event) => {
  let data = {}
  switch (monitor.type) {
    case 'host':
      data = prepareHostNotification(monitor, monitor_event)
      break
    case 'script':
    case 'process':
    case 'scraper':
    case 'nested':
      data = prepareDefaultNotification(monitor, monitor_event)
      break
    default:
      logger.log('monitor type %s not handled', monitor.type)
      break
  }
  return data
}

const prepareHostNotification = (monitor, monitor_event) => {
  let data = {}
  switch (monitor_event) {
    case 'updates_started':
      data.msg = `${monitor.name} started reporting again.`
      break
    case 'updates_stopped':
      data.msg = `${monitor.name} stopped reporting updates.`
      break
  }
  return data
}

const prepareDefaultNotification = (monitor, monitor_event) => {
  let data = {}
  switch (monitor_event) {
    case 'recovered':
      data.msg = `${monitor.name} recovered.`
      break
    case 'failure':
      data.msg = `${monitor.name} checks failed.`
      break
  }
  return data
}

const prepareWebhookNotification = (webhook) => {
  let data = {}
  data.msg = `Webhook ${webhook.name} triggered.`
  return data
}

const dumpSNSMessage = (dummyArn, filename, payload) => {
  if (process.env.NODE_ENV !== 'production') {
    let data = Object.assign({}, payload, { dummyArn })
    fs.appendFile(
      filename,
      JSON.stringify(data)  + "\n",
      (err) => {
        if (err) {
          logger.error(err)
        }
      }
    )
  }
}

const handleSNSError = (user, device) => {
  app.sns.deleteEndpoint({
    EndpointArn: device.endpoint_arn
  }, function(error, data) {
    if (error) {
      logger.error('Error deleting previous Endpoint Arn')
      logger.error('%o',error);
      return
    }

    //remove user device on db
    user.devices = user.devices || []
    var index = user.devices.findIndex(elem => elem.uuid == device.uuid)
    if (index > -1) {
      user.devices.splice(index, 1)
    }
    User.update({id: user.id}, {devices: user.devices}).exec((error,user) => {
      if (error) {
        logger.error('Error creating new Endpoint Arn')
        logger.error('%o',error);
        return
      }
      logger.debug('Successfully removed Endpoint Arn.')
    })
  })
}
