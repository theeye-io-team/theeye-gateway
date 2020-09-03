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
      const { id, topic } = message

      if (!message.data.model_id) {
        console.error(message)
        throw new Error('no model_id in message')
      }

      let data = {}
      for (let prop in message.data) {
        if (prop !== 'model') {
          data[prop] = message.data[prop]
        }
      }

      const channel = `${data.organization_id}:${topic}:${data.model_id}`
      logger.debug('%s|publishing message to %s', message.id, channel)
      this.redis.publish(channel, JSON.stringify({ topic, id, data }))
    }
  }

  return new Messages()
}
