const got = require('got')
module.exports = (params) => {
  return async (req, res, next) => {
    try {
      const url = req.url
      res.writeHead(200, {})
      got.stream(url).pipe(res)
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
