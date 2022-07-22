const template = require('./template')

module.exports = function(data) {
  data.subject = "TheEye password reset"
  data.title = 'Password reset'
  data.motive = "A password reset was requested for your account.\nIf this was you, please click the button, otherwise you may disregard this email"
  data.tagline = " "
  data.text = ""
  data.hasLink = true
  data.link = data.url
  data.btn_text = "Reset your passsword"

  return template(data)
}