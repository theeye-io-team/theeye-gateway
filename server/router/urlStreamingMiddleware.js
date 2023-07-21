const got = require('got')
module.exports = (params) => {
  return async (req, res, next) => {
    try {
      const url = req.url
      //const headers = {
      //  'Content-Disposition': 'attachment; filename=' + file.filename
      //}
      //res.writeHead(200, headers)
      res.writeHead(200, {})
      got.stream(url).pipe(res)
      //res.set('Content-Type', response.headers['content-type'])
      //res.status(200).send(response.body)
    } catch (err) {
      // handle GOT errors
      if (err.name === 'HTTPError') {
        if (err.message.includes('Response code 404')) {
          next(new ClientError('Not Found', {statusCode:404}))
        }
      } else {
        next(err)
      }
    }
  }
}
