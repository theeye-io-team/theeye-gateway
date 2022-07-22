const template = require('./template')

module.exports = function(data) {
  data.subject = "You've invited to TheEye"
  data.title = 'TheEye invitation'
  data.motive = `You've been invited to TheEye.io by <strong>${data.inviter.username}</strong> (${data.inviter.email})`
  data.tagline = "Everything is simpler with TheEye"
  data.text = `Your account is ready to use. Please contact <strong>${data.inviter.username}</strong> (${data.inviter.email}) to obtain your access credentials.`
  data.hasLink = false

  return template(data)
}
