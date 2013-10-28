var fs = require('fs');
var path = require('path');
var parseUrl = require('url').parse;
var formatUrl = require('url').format;

var authRcFile = '.authrc';

module.exports = function(filePath, bowerCfg) {
    if (!authFileExists(filePath)) {
        return;
    }

    return matchAuth(bowerCfg, filePath);
};

function echo() {
  console.log.apply(null, arguments);
}

function getUserHome() {
    return path.normalize(process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME']);
}

function isValidUrl(string) {
    return (/^[git(\+(ssh|https?))|http|git]?:\/\//i).test(string) || (/\.git\/?$/i).test(string)
      || (/^git@/i).test(string) || (/^(https?):\/\//i).test(string);
}

function escapeChars(string) {
    return typeof string === 'string' ? string.replace(/\W/ig, function(match) {
        return '\\' + match;
    }) : '';
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

    return function(url) {
        var host, authCredentials,
            urlObj = parseUrl(url),
            hostname = urlObj.hostname,
            port = urlObj.url,
            auth = urlObj.auth;

        function matchHost(host) {
            if (!isValidUrl(host)) {
                host = parseUrl('http://' + host);
            }

            function matchPort() {
                if (host.port && port) {
                    return host.port === port;
                }
                return true;
            }

            return host.hostname === hostname && matchPort();
        }

        if (!config) {
            return url;
        }

        for (host in config) {
            if (matchHost(host)) {
                if (config[host].username && config[host].password) { 
                    authCredentials = config[host];
                }
                break;
            }
        }

        return authCredentials;
    };
}

function matchAuth(bower, bowerPath) {
    var key,
        auth = getAuthFile(bowerPath);

    function addAuth(obj) {
        var key;

        function setURIAuth(url, credentials) {
            if (!credentials) {
                return url;
            }

            url = parseUrl(url);
            if (!url.auth && credentials.username) {
                url.auth = credentials.username + (credentials.password ? ':' + credentials.password : '');
            }

            return formatUrl(url);
        }

        function getAuth(url) {
            return isValidUrl(url) ? setURIAuth(url, auth(url)) : url;
        }

        for (key in obj) {
            obj[key] = getAuth(obj[key]);
        }
    }

    ['dependencies', 'devDependencies']
        .forEach(function (prop) {
            var depsObj = bower[prop];
            if (typeof depsObj === 'object') {
                addAuth(depsObj);
            }
        });

    return bower;
}
