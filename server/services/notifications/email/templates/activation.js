const template = require('./template')

module.exports = function(data) {
  data.subject = "You've invited to TheEye"
  data.title = 'TheEye invitation'
  data.motive = "You've been invited to be part of TheEye.io"
  data.text = `Welcome, ${data.name}!\nYou've been invited to be part of TheEye.io.\nActivate your account by clicking the button below`
  data.hasLink = true
  data.link = data.activation_link
  data.btn_text = 'Activate your account'

  return template(data)
}
