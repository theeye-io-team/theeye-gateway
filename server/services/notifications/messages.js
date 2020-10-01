const logger = require('../../logger')(':services:notifications:messages')
//const TopicConstants = require('../../constants/topics')
const redis = require('redis')

module.exports = function (app, config) {
  class Messages {
    constructor () {
      this.redis = redis.createClient(app.config.redis)
    }

    /**
     * @param {Object} message
     * @return {Promise}
     */
    async sendEvent (message) {
      const { id, topic, data } = message

      if (!data.model_id) {
        let err = new Error(`no model_id in message ${id}, ${topic}`)
        err.data = message
        logger.error('%o',err)
      } else {
        let payload = {}
        for (let prop in data) {
          if (prop !== 'model') {
            payload[prop] = data[prop]
          }
        }

        const channel = `${data.organization_id}:${topic}:${data.model_id}`
        logger.debug('%s|publishing message to %s', message.id, channel)

        this.redis.publish(channel, JSON.stringify({ topic, id, data: payload }))
      }
    }
  }

  return new Messages()
}
