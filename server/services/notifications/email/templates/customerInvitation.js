const template = require('./template')

module.exports = function(data) {
  data.subject = "You've invited to TheEye"
  data.title = 'TheEye invitation'
  data.motive = `You've been granted access to the organization <strong>${data.customer_name}</strong> on TheEye.io`
  data.text = ""
  data.hasLink = false

  return template(data)
}