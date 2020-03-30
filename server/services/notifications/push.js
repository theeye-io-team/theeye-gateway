const app = require('../../app')
const logger = require('../logger')('eye:libs:push-notifications')
const fs = require('fs')

const dumpfile = '/tmp/theeye-push-dump.log'

class Push {

  constructor () {
  }

  send (event, users) {
    const model = event.data.model
    let data
    switch (event.topic) {
      case 'monitor-state':
        let monitor_event = event.data.monitor_event
        let severity = model.failure_severity

        if (severity === 'HIGH' || severity === 'CRITICAL') {
          data = prepareMonitorStateChangeNotification(model, monitor_event)
          if (data.msg) this.dispatch(data, users)
        }
        break
      case 'job-crud':
        data = prepareJobNotification(model)
        if (data.msg) this.dispatch(data, users)
        break
      case 'webhook-triggered':
        data = prepareWebhookNotification(model)
        if (data.msg) this.dispatch(data, users)
        break
    }
  }

  dispatch (data, users) {
    if (!data.msg) {
      return logger.error('Error. invalid message, undefined condition')
    }
    var message = data.msg.replace(/['"]+/g, '')
    var action = data.action || 'showNotificationsTab'

    var params = {
      MessageStructure: 'json',
      Message: JSON.stringify({
        "GCM": "{ \"data\": { \"message\": \"" + message + "\",  \"action\": \"" + action + "\", \"style\": \"inbox\", \"summaryText\": \"%n% New notifications\"} }",
        "APNS_SANDBOX": "{ \"aps\": { \"alert\": \"" + message + "\" } }",
        "APNS": "{ \"aps\": { \"alert\": \"" + message + "\" } }"
      })
    }

    logger.debug('Sending push notification to users with message: ' + message)

    if (users.length) {
      users.forEach(function (user) {
        if (user.notifications && user.notifications['push'] !== true) {
          // user opt out
          return
        }

        if (user.devices) {
          user.devices.forEach(function (device) {
            params.TargetArn = device.endpoint_arn
            logger.debug('Sending notification to target arn: ' + params.TargetArn)

            app.sns.publish(params, function (error, data) {
              if (error) {
                logger.error('%o', error)
                logger.error('Error sending notification, deleting endpoint arn: ' + params.TargetArn)
                handleSNSError(user, device)
              } else {
                logger.debug('Push notification sent.')
              }
            })
          })
        }

        dumpSNSMessage(`arn:user:${user.username}`, dumpfile, params)
      })
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
  if (process.env.NODE_ENV==='localdev') {
    if (!filename) {
      return logger.error('no filename provided')
    }

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
