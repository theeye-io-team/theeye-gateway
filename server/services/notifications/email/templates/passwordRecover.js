module.exports = function(data) {
  let html = ` <div style="widht: 100%; height: 90px; border-bottom: 3px solid #d88e47; background: #eee;">
    <a class="navbar-brand" href="http://theeye.io" style="height: 72px; padding: 0px 15px; border-right: 1px solid #7c98ac; margin: 10px 0; float: left">
      <img src="https://app.theeye.io/images/logo-hor.png" alt="The eye">
    </a>

    <h2 style="color: #38688a; text-align: center; padding-top: 30px;">TheEye.io</h2>
  </div>

  <div class="content" style="font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; font-size: 100%; line-height: 1.6em; display: block; max-width: 600px; margin: 30px 0px; padding: 0;">
    <p>If you asked to reset your password <a href="${data.url}"> click here </a></p>
    <p>If you haven't, please ignore this email.</p>
  </div>`

  return html
}
