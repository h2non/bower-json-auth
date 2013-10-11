var fs = require('fs');
var path = require('path');
var parseUrl = require('url').parse;

var authRcFile = '.authrc';

module.exports = function (bowerPath, bowerCfg) {
  if (!authFileExists(bowerPath)) {
    return;
  }

  return matchAuth(bowerCfg, bowerPath);
};

function getUserHome() {
  return path.normalize(process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME']);
}

function isURL(string) {
  return /^git(\+(ssh|https?))?:\/\//i.test(string) || /\.git\/?$/i.test(string)
          || /^git@/i.test(string) || /^https?:\/\//i.test(string);
}

function escapeChars(string) {
  // todo: review aditional characters to escape
  return string.replace(/[\$\:\@\?\#]/g, function (match) {
    return '\\' + match;
  });
}

function readJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath));
  } catch (e) {
    echo('Error while reading JSON file: ' + e);
    return false;
  }
}

function getLocalFilePath(bowerFile) {
  return path.join(path.dirname(bowerFile) || process.cwd(), authRcFile);
}

function authFileExists(bowerFile) {
  return fs.existsSync(getLocalFilePath(bowerFile)) || fs.existsSync(path.join(getUserHome(), authRcFile));
}

function getAuthFilePath(bowerFile) {
  var authFile = getLocalFilePath(bowerFile);

  if (fs.existsSync(authFile)) {
    return authFile;
  }

  authFile = path.join(getUserHome(), authRcFile);
  if (fs.existsSync(authFile)) {
    return authFile;
  }

  return false;
}

function getAuthFile(bowerFile) {
  var config;

  if (authFileExists(bowerFile)) {
    config = readJSON(getAuthFilePath(bowerFile));
  }

  return function (url) {
    var authCredentials,
        parsedUrl = parseUrl(url),
        hostname = parsedUrl.hostname,
        auth = parsedUrl.auth;

    if (!url || !config || auth) {
      return;
    }

    for (var key in config) {
      if (hostname === key) {
        if (config[key].username && config[key].password) { 
          authCredentials = config[key];
        }
        break;
      }
    }

    return authCredentials;
  };
}

function matchAuth(bower, bowerPath) {
  var auth = getAuthFile(bowerPath);

  function match(obj) {

    function addAuth(url, credentials) {
      if (!credentials) {
        return url;
      }

      url = url.split('://');

      return url[0] + '://' + escapeChars(credentials.username) + ':' + escapeChars(credentials.password) + '@' + url[1];
    }

    function getAuth(url) {
      return isURL(url) ? addAuth(url, auth(url)) : url;
    }

    for (var key in obj) {
      obj[key] = getAuth(obj[key]);
    }

  }

  for (var key in bower) {
    if (key === 'devDependencies' || key === 'dependencies') {
      match(bower[key]);
    }
  }
}
