//const template = require('./template')

module.exports = function(data) {
  data.hasLink = true
  data.link = data.activation_link
  data.email_body_text = 'You have been invited to join TheEye. Click on the button to complete your registration.'
  data.accept_button = 'Register'

  return template(data)
}

const template = (data) => {
  const html = `
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css?family=Montserrat:700" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css?family=Open+Sans:400,600&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Open Sans', sans-serif;
            font-weight: 400;
            font-size: 16px;
            color: #000;
            margin: 0;
            padding: 50px 100px;
            background: #f2f2f2;
          }

          .container {
            max-width: 650px;
            margin: 0 auto
          }

          .center {
            text-align: center;
          }

          h1 {
            font-family: 'Montserrat', sans-serif;
            font-weight: 700;
            font-size: 32px;
            color: #004c97
          }

          h4 {
            font-weight: 600;
            color: #004c97;
            font-size: 24px
          }

          .footer {
            font-size: 14px;
            text-align: center;
            margin: 50px 0 30px;
            padding: 10px;
            border-top: 1px solid #ddd
          }

          p {
            margin: 0
          }

          .btn {
            font-family: 'Montserrat', sans-serif;
            display: inline-block;
            padding: 10px 30px;
            color: #fff;
            background: #fc7c00;
            margin: 30px 0;
            border-radius: 4px;
            text-decoration: none
          }
        </style>
      </head>

      <body>
        <div class="container">
          <div class="center">
            <img src="https://cdn.theeye.io/logo/theeye.png" alt="TheEye" style="width:300px;">
          </div>
          <br />
          <p>${data.name}</p>
          <p>${data.email_body_text}</p>
          <br />
          <a class="btn" href="${data.link}">${data.accept_button}</a>
          <br />
          <div class="footer">
            TheEye | theeye.io | Copyright &copy; 2023
          </div>
        </div>
      </body>

    </html>
  `
  return html
}
