var _ = require('lodash');
var urllib = require('urllib');
var Redis = require('ioredis');
var debug = require('debug')('huawei_push:utils');
var constant = require('./constant');
var REDIS_KEY = 'HUAIWEI::TOKEN'
var hw_token = {
  'access_token': 0,
  'expire': 0
};

var defaults = {
  timeout: 5000
};

function requestAccessWithRedis(callback) {
  debug('requestAccessWithRedis:', this.options.redis);
  var that = this;
  var redis = new Redis(this.options.redis);
  redis.get(REDIS_KEY, function (err, token) {
    if (err || !token) {
      getToken.call(that, function (err, hw_token) {
        redis.setex(REDIS_KEY, hw_token['expire'], hw_token['access_token'], function () {
          redis.close()
          delete redis
          callback(null, hw_token['access_token']);
        })
      })
    } else {
      redis.ttl(REDIS_KEY, function (err, ttl) {
        debug('get cache token', token, ttl)
        if (err || !ttl || parseInt(ttl, 10) < Math.floor(Date.now() / 1000)) {
          getToken.call(that, (function (err, hw_token) {
            redis.setex(REDIS_KEY, hw_token['expire'], hw_token['access_token'], function () {
              redis.close()
              delete redis
              callback(null, hw_token['access_token']);
            })
          }))
        } else {
          hw_token.access_token = token
          redis.close()
          delete redis
          callback(null, token);
        }
      });
    }
  });
}


function requestAccess(callback) {
  debug('requestAccess ');
  var nowSeconds = Math.floor(Date.now() / 1000);

  if (hw_token['expire'] > nowSeconds) {
    callback(null, hw_token['access_token']);
  } else {
    getToken.call(this, function (err, hw_token) {
      callback(null, hw_token['access_token']);
    })
  }
}


function getToken(callback) {
  debug('get new token ')
  url = constant.accessTokenAPI;
  data = {
    'client_id': this.options.appId,
    'client_secret': this.options.appSecret,
    'grant_type': 'client_credentials'
  };

  var options = {
    method: 'POST',
    data: data,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    contentType: 'application/x-www-form-urlencoded',
    dataType: 'json',
    timeout: this.options.timeout
  };

  urllib.request(url, options, function (err, data) {
    debug('response:', err, data);
    var nowSeconds = Math.floor(Date.now() / 1000);

    if (err) {
      callback(err, null);
    }

    if (data === undefined) {
      err = new Error('request access_token response is undefined');
      return callback(err, null);
    }

    if (data.error) {
      err = new Error(data.error_description);
      return callback(err, null);
    }

    hw_token['expire'] = nowSeconds + data['expires_in'];
    hw_token['access_token'] = data['access_token'];
    callback(null, hw_token);
  });
}


function requestNotification(token, data, appMethod, callback) {
  url = constant.baseAPI;


  var params = notificationParams(token, appMethod, data);
  debug('request:', url, params);
  var options = {
    method: 'POST',
    data: params,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    dataType: 'json',
    timeout: defaults.timeout
  };

  urllib.request(url, options, function (err, data) {
    debug('response:', err, data);

    if (err) {
      return callback(err);
    }

    if (data === undefined) {
      err = new Error('notification response is undefined');
      return callback(err, null);
    }

    // fail if data.code is 0
    if (data.result_code !== 0) {
      err = new Error(data.result_desc);
      err.result_code = data.result_code;
      return callback(err);
    }

    callback(null, data);
  });
}

function notificationParams(token, appMethod, data) {
  data['tokens'] = token;
  data['nsp_ts'] = Math.floor(Date.now() / 1000);
  data['nsp_svc'] = constant.apiMethod + appMethod;
  data['nsp_fmt'] = 'JSON';
  data['access_token'] = hw_token['access_token'];
  data['android'] = JSON.stringify(data['android']);
  return data;
}

module.exports.requestNotification = function (token, data, appMethod, callback) {
  requestNotification.call(this, token, data, appMethod, callback);
};

module.exports.requestAccess = function (callback) {
  if (this.options && this.options.redis) {
    requestAccessWithRedis.call(this, callback)
  } else {
    requestAccess.call(this, callback);
  }
};

/*
 * config: configure for Huawei-Push
 * opts: options for parseOptions
 */
module.exports.parseOptions = function (config) {
  if (!_.isObject(config)) {
    throw new Error('options must be Object');
  }

  this.options = _.clone(defaults);
  _.assign(this.options, config);

  if (!_.isNumber(this.options.appId)) {
    throw new Error('options.appId required');
  }

  if (!_.isString(this.options.appSecret)) {
    throw new Error('options.appSecret required');
  }
};