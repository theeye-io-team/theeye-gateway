module.exports = function(data) {
let html = `
<!DOCTYPE html>
<html style="font-family: 'Trebuchet MS', sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;">
<head>
<meta name="viewport" content="width=device-width">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body bgcolor="#ffffff" style="font-family: 'Trebuchet MS', sans-serif; font-size: 100%; line-height: 1.6em; -webkit-font-smoothing: antialiased; height: 100%; -webkit-text-size-adjust: none; width: 100% !important; margin: 0; padding: 0;">


<table class="body-wrap" bgcolor="#ffffff" style="font-size: 100%; width: 100%; margin: 0; padding: 20px;">
  <tr style="line-height: 1.6em; margin: 0; padding: 0;">
    <td class="container" bgcolor="#ffffff" style="font-size: 100%; line-height: 1.6em; clear: both !important; display: block !important; max-width: 600px !important; margin: 0 auto; border: 1px solid #f0f0f0;">
      <!-- body -->
      <!-- content -->

      <div style="clear:both;width: 100%; height: 90px; background: #fafafa;">
        <div style="width: 30%; display: block; float: left; margin-top: 15px">
          <a href="http://theeye.io" style="float: left">
            <img src="https://app.theeye.io/images/logo-hor.png" alt="TheEye" width="150">
          </a>
        </div>
        <div style="width: 70%; display: block; float: right; margin-top: 15px">
            <!-- <img src="https://app.theeye.io/images/logo-email.png" alt="TheEye"> -->
          <p><span style="font-family: 'Trebuchet MS', sans-serif; font-size: 21px; font-weight: normal; color: #38688a; vertical-align: center; ">Valoriza el talento humano por sobre las tareas repetitivas</span></p>
        </div>
      </div>

      <div class="content" style="font-size: 100%; display: block; max-width: 600px; padding: 0;">
        <table style="font-size: 100%; width: 100%; margin: 0; padding: 0;">
          <tr style="font-size: 100%; margin: 0; padding: 0;">
            <td style="font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;">
              <p style="font-family: 'Trebuchet MS', sans-serif; font-size: 21px; font-weight: normal; margin: 0 0 10px; padding-top: 10px; color:#700e2e; text-align: center;">
                <strong>Bienvenido/a</strong>
              </p>
              <p style="font-family: 'Trebuchet MS', sans-serif; font-size: 21px; font-weight: normal; margin: 0 0 10px; padding-top: 10px; color:#700e2e; text-align: center;">
                <strong>Welcome</strong>
              </p>
              <p style="font-family: 'TRebuchet MS', sans-serif; font-size: 21px; font-weight: normal; margin: 0 0 10px; padding-top: 10px;  text-align: center; color: #004e7a">
                <strong>${data.name}</strong>,
              </p>
              <p style="font-family: 'Trebuchet MS', sans-serif; font-size: 21px; font-weight: normal; margin: 0 0 10px; padding-top: 10px; color:#700e2e; text-align: center;">
                <strong>Gracias por registrarte en TheEye.io!</strong>
              </p>
              <p style="font-family: 'Trebuchet MS', sans-serif; font-size: 21px; font-weight: normal; margin: 0 0 10px; padding-top: 10px; color:#700e2e; text-align: center;">
                <strong>Thank you for registering on TheEye.io!</strong>
              </p>
              <p style="font-family: 'TRebuchet MS', sans-serif; font-size: 14px; font-weight: normal; margin: 0 0 10px; padding-top: 10px;  text-align: left; color: #555555">
                Todo es m&aacute;s f&aacute;cil con TheEye. Para continuar por favor active su cuenta.
              </p>
              <p style="font-family: 'TRebuchet MS', sans-serif; font-size: 14px; font-weight: normal; margin: 0 0 10px; padding-top: 10px;  text-align: left; color: #555555">
                Everything is easier with TheEye. Please activate your account to continue.
              </p>
              <p style="font-family: 'TRebuchet MS', sans-serif; font-size: 14px; font-weight: normal; margin: 0 0 10px; padding: 0; text-align:center">
                <a href="${data.activation_link}" target="_blank" style="font-family: 'Trebuchet MS', sans-serif; font-size: 100%; line-height: 2; color: #ffffff; border-radius: 18px; display: inline-block; cursor: pointer; font-weight: bold; text-decoration: none; background: #130e40; margin: 0; padding: 0; border-color: #130e40; border-style: solid; border-width: 10px 20px;">
                      ACTIVAR / ACTIVATE</a>
              </p>
              <p style="font-family: 'TRebuchet MS', sans-serif; font-size: 14px; font-weight: normal; margin: 0 0 10px; padding-top: 10px; text-align: center; color: #130e40">
                <a href="${data.activation_link}" style="font-size: 100%;  display: inline-block; cursor: pointer; font-weight: bold;">
                      ${data.activation_link}</a>
              </p>
              <p style="font-family: 'Trebuchet MS', sans-serif; font-size: 21px; font-weight: normal; margin: 0 0 10px; padding-top: 10px; color:#700e2e; text-align: center;">
                <strong>Gracias y que tengas un maravilloso d&iacute;a!</strong>
              </p>
              <p style="font-family: 'Trebuchet MS', sans-serif; font-size: 21px; font-weight: normal; margin: 0 0 10px; padding-top: 10px; color:#700e2e; text-align: center;">
                <strong>Thanks and have a wonderful day!</strong>
              </p>
              <p style="font-size: 21px; font-weight: normal; margin: 0 0 10px; padding-top: 10px; color:#521D2F; text-align: center;">
                <a href="http://theeye.io" style="width:150px;height: 36px; margin:0px 220px 60px 200px; float: left">
                  <img src="https://app.theeye.io/images/logo-hor.png" alt="TheEye" width="200">
                </a>
              </p>
            </td>
          </tr>
        </table>
      </div>
      <!-- /content -->
      <!-- /body -->

      <!-- footer -->
      <!-- content -->
      <div class="content" style="font-size: 100%; line-height: 1.6em; display: block; max-width: 600px; margin: 0 auto; padding: 0; background: #fafafa; vertical-align:center">
        <!-- <table style="font-family: 'Trebuchet MS', sans-serif; font-size: 100%; line-height: 1.6em; max-width: 600px; margin: 0; padding: 0;"> -->
        <table style="font-size: 100%; line-height: 1.6em; width: 100%; margin: 0; padding: 0;">
          <tr style="font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;">
            <td align="center">
                  <div style="width: 25%; display: block; float: left">
                    <a href="https://theeye.io"><img src="https://app.theeye.io/images/linkedin.png" alt="TheEye" style="margin-top:15px; width: 40px; height: 40px"></a><br>
                    <span style="font-family: 'Trebuchet MS', sans-serif; font-size: 9px; line-height: 1em; font-weight: normal; margin-left: 8px">TheEye Inc.</span>
                  </div>
                  <div style="width: 25%; display: block; float: left">
                    <a href="https://theeye.io"><img src="https://app.theeye.io/images/facebook.png" alt="TheEye" style="margin-top:15px; width: 40px; height: 40px"></a><br>
                    <span style="font-family: 'Trebuchet MS', sans-serif; font-size: 9px; line-height: 1em; font-weight: normal; margin-left: 8px">/theeye.io</span>
                  </div>
                  <div style="width: 25%; display: block; float: left">
                    <a href="https://theeye.io"><img src="https://app.theeye.io/images/twitter.png" alt="TheEye" style="margin-top:15px; width: 40px; height: 40px"></a><br>
                    <span style="font-family: 'Trebuchet MS', sans-serif; font-size: 9px; line-height: 1em; font-weight: normal; margin-left: 8px">@theeye_io</span>
                  </div>
                  <div style="width: 25%; display: block; float: left">
                      <a href="https://theeye.io"><img src="https://app.theeye.io/images/youtube.png" alt="TheEye" style="margin-top:15px; width: 40px; height: 40px"></a><br>
                      <span style="font-family: 'Trebuchet MS', sans-serif; font-size: 9px; line-height: 1em; font-weight: normal; margin-left: 8px">@theeye_io</span>
                  </div>
            </td>
          </tr>
        </table>
      </div>
      <!-- /content -->
      <!-- /footer -->

    </td>
    <td style="font-family: 'Trebuchet MS', sans-serif; font-size: 100%; line-height: 1.6em; margin: 0; padding: 0;"></td>
  </tr>
</table>
</body>
</html>
`

return html
}
