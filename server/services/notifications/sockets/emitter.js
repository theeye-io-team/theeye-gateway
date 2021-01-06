const logger = require('../../../logger')(':services:notifications:sockets:emitter')
const TopicConstants = require('../../../constants/topics')

class Emitter {
  emit (io, event, user) {
    const topic = event.topic
    const data = event.data

    logger.debug('emit event "%s"', topic)

    if (user === 'admin') {
      // to all users in admin
      this.sendMembersAdminEvent(io, topic, data)
    } else {
      switch (topic) {
        case TopicConstants.NOTIFICATION_CRUD:
        case TopicConstants.JOB_RESULT_RENDER:
          //this.sendMemberEvent(io, topic, data, user._id)
          this.sendMemberEvent(io, topic, data, data.user_id)
          break;
        case TopicConstants.SESSION:
          //this.sendSessionEvent(io, topic, data, user._id)
          this.sendSessionEvent(io, topic, data, data.model.user_id)
          break;
        default:
          this.sendMemberEvent(io, topic, data, user._id)
          break;
      }
    }
  }

  sendSessionEvent (io, topic, data, user_id) {
    const room = `${data.model._id}:${user_id}:${TopicConstants.SESSION}`
    logger.debug(`sending message to ${room}`)
    io.sockets.in(room).emit(topic, data)
  }

  /**
   * notify single user
   */
  sendMemberEvent (io, topic, data, user_id) {
    const room = `${data.organization_id}:${user_id}:${topic}`
    logger.debug(`sending message to ${room}`)
    io.sockets.in(room).emit(topic, data)
  }

  /**
   * notify all admin members
   */
  sendMembersAdminEvent (io, topic, data) {
    const room = `${data.organization_id}:admin:${topic}`
    logger.debug(`sending message to ${room}`)
    io.sockets.in(room).emit(topic, data)
  }
}

module.exports = Emitter
