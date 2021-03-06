var _extends =
  Object.assign ||
  function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };

function _objectWithoutProperties(obj, keys) {
  var target = {};
  for (var i in obj) {
    if (keys.indexOf(i) >= 0) continue;
    if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
    target[i] = obj[i];
  }
  return target;
}

const dump = require('sharp-pad-dump');
const React = require("react");
const http = require("http");
const url = require("url");
const qs = require("qs");
const EventEmitter = require('events');
let id = 1;
let handlers = {};
let port = 5256;

const events = new EventEmitter();

const oldClear = dump.clear;
dump.clear = function () {
  clearHandlers();
  return oldClear.apply(dump);
}

function listen(httpPort = 5256) {
  port = httpPort;
  const http = require("http");

  const requestHandler = (request, response) => {
    const { query } = url.parse(request.url, true);
    const { req, id } = query;
    events.emit('rawRequest', request, id)
    const handler = handlers[id];
    if (!handler) {
      response.statusCode = 400;
      response.end();
    }

    if (req === "action") {
      try {
        events.emit('actionRequest', id)
        handler();
        response.statusCode = 200;
        response.end();
      } catch (err) {
        response.statusCode = 500;
        response.end();
        throw err;
      }
    } else if (req === "form") {
      let body = [];
      request
        .on("data", chunk => {
          body.push(chunk);
        })
        .on("end", () => {
          body = Buffer.concat(body).toString();
          try {
            const data = qs.parse(body);
            events.emit('formRequest', data, id);
            handler(data);
            response.statusCode = 200;
            response.end();
          } catch (err) {
            response.statusCode = 500;
            response.end();
            console.error(err);
          }
        })
        .on("error", () => {
          response.statusCode = 500;
          response.end();
        });
    } else {
      response.statusCode = 400;
      response.end();
    }
  };

  const server = http.createServer(requestHandler);
  server.listen(port, err => {
    if (err) {
      return console.error(err);
    }

    events.emit('listening', port);
  });

  return server;
}

function clearHandlers() {
  handlers = {};
  events.emit('handlersCleared');
}

function getLinkScript(id) {
  return `
    (function () {
      const link = document.getElementById(${id})
      link.onclick = function (e) {
        e.preventDefault()
        e.stopPropagation()
        fetch('http://localhost:${port}?req=action&id=${id}')
        return false
      }
    })()
  `;
}

class Action extends React.Component {
  componentWillMount() {
    this.id = id++;
    events.emit('newElement', 'action', id);
  }

  render() {
    const _props = this.props,
      { onClick, children } = _props,
      props = _objectWithoutProperties(_props, ["onClick", "children"]);
    if (typeof onClick === "function") {
      handlers[this.id] = onClick;
    }

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "a",
        _extends({}, props, {
          href: `http://localhost:${port}?req=action&id=${this.id}`,
          id: this.id
        }),
        children
      ),
      React.createElement("script", {
        dangerouslySetInnerHTML: {
          __html: getLinkScript(this.id)
        }
      })
    );
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

        const params = new URLSearchParams()
        for (let pair of formData.entries()){
            typeof pair[1] === 'string' && params.append(pair[0], pair[1])
        }

        fetch('http://localhost:${port}?req=form&id=${id}', {
          method: 'post',
          body: params.toString()
        })

        return false
      }
    })()
  `;
}

class Form extends React.Component {
  componentWillMount() {
    this.id = id++;
    events.emit('newElement', 'form', id);
  }

  render() {
    const _props2 = this.props,
      { onSubmit, children } = _props2,
      props = _objectWithoutProperties(_props2, ["onSubmit", "children"]);
    if (typeof onSubmit === "function") {
      handlers[this.id] = onSubmit;
    }

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "form",
        _extends({}, props, { id: this.id }),
        children
      ),
      React.createElement("script", {
        dangerouslySetInnerHTML: {
          __html: getFormScript(this.id)
        }
      })
    );
  }
}

function getPort() {
  return port
}

function setPort(value) {
  port = value
}

module.exports = {
  Action,
  Form,
  listen,
  getPort,
  setPort,
  events,
  clearHandlers
};
