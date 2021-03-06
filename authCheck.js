const request = require('request');
const encoding = require('encoding');

const logger = require('./logger');

const Config = require('./config');

var check = function(ident, ip, daa, callback) {
  if(ident.trim() == "") {
    callback(null, "No ident");
    return;
  }

  if(Config.siteURL == null) {
    var url = "http://api.blocklandglass.com";
  } else {
    var url = Config.siteURL;
  }

  url += "/api/3/authCheck.php?ident=" + ident + "&ip=" + ip;

  if(daa != undefined) {
	  url += "&daa=1";
  }

  var options = {
	  method: 'post',
	  body: daa,
	  json: true,
	  url: url
  };
  request(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {

      callback(body, null);

    } else {
      if(error) {
        //logger.error('Auth error for ident ' + ident);
        callback(null, error);
      } else {
        //logger.error('Auth error for ident ' + ident + ', received ' + response.statusCode);
        callback(null, "Status: " + response.statusCode);
      }
    }
  });
}

module.exports = {check};
