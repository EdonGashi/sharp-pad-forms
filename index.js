const http = require('http')
const url = require('url')
let id = 1
let listeners = {}
let port = 5256

export function listen(httpPort = 5256) {
  port = httpPort
  const http = require('http')

  const handler = (request, response) => {
    const { query } = url.parse(request.url, true)
    const { req, id } = query
    const listener = listeners[id]
    if (!listener) {
      response.statusCode = 400
      response.end()
    }

    if (req === 'link') {
      try {
        listener()
      } catch (err) {
        response.statusCode = 500
        response.end()
        throw err
      }
    } else if (req === 'form') {
      let body = []
      request
        .on('data', (chunk) => {
          body.push(chunk);
        })
        .on('end', () => {
          body = Buffer.concat(body).toString()
          try {
            listener(qs.parse(body))
          } catch (err) {
            response.statusCode = 500
            response.end()
            console.error(err)
          }
        })
        .on('error', () => {
          response.statusCode = 500
          response.end()
        })
    } else {
      response.statusCode = 400
      response.end()
    }
  }

  const server = http.createServer(handler)
  server.listen(port, err => {
    if (err) {
      return console.error(err)
    }
  })

  return server
}

export function clearListeners() {
  listeners = {}
}

function getLinkScript(id) {
  return `
    (function () {
      const link = document.getElementById(${id})
      link.onclick = function (e) {
        e.preventDefault()
        fetch('http://localhost:${port}?req=link&id=${id}')
      }
    })()
  `
}

export class Action extends React.Component {
  componentWillMount() {
    this.id = id++
  }

  render() {
    const { onClick, children, ...props } = this.props
    if (typeof onClick === 'function') {
      listeners[this.id] = onClick
    }

    return <React.Fragment>
      <a {...props} href={`http://localhost:${port}?req=link&id=${this.id}`} id={this.id}>
        {children}
      </a>
      <script dangerouslySetInnerHTML={{
        __html: getLinkScript(this.id)
      }} />
    </React.Fragment>
  }
}

function getFormScript(id) {
  return `
    (function () {
      const form = document.getElementById(${id})
      form.onsubmit = function (e) {
        e.preventDefault()
        const formData = new FormData()
        for (let i = 0; i < form.length; i++) {
          formData.append(form[i].name, form[i].value);
        }

        fetch('http://localhost:${port}?req=form&id=${id}', {
          method: 'post',
          body: formData
        })

        return false
      }
    })()
  `
}

export class Form extends React.Component {
  componentWillMount() {
    this.id = id++
  }

  render() {
    const { onSubmit, children, ...props } = this.props
    if (typeof onSubmit === 'function') {
      listeners[this.id] = onSubmit
    }

    return <React.Fragment>
      <form {...props} id={this.id}>
        {children}
      </form>
      <script dangerouslySetInnerHTML={{
        __html: getFormScript(this.id)
      }} />
    </React.Fragment>
  }
}
