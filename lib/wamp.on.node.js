
/*!
 * wamp.on.node.js: A node.js WAMP(c) Server
 * Forked from wamp.io.js by Neville Franks
 * Copyright (c) 2012 Nico Kaiser <nico@kaiser.me>
 * MIT Licensed
 *	Last change: NF 10/07/2013 5:36:55 PM
 */

"use strict";
 
/**
 * Server constructor.
 *
 * @api public
 */
exports.Server = require('./server');


/**
 * Client constructor.
 *
 * @api public
 */
exports.Client = require('./client');

/**
 * Attach to WebSocket.IO Server.
 *
 * @param {wsio.Server} server
 * @param {Object} options
 * @return {wsio.Server}
 * @api public
 */
exports.attach = function(server, options) {
  var wamp = new exports.Server(options);

  server.on('connection', function(client) {
    wamp.onConnection(client);
  });

  return wamp;
}


/**
 * Connect to WebSocket.IO Server.
 *
 * @param {websocket.io} websocket
 * @param {Object} onconnect handler
 * @param {Object} onhangup handler
 * @param {Object} options
 * @api public
 */
exports.connect = function(wsuri, onconnect, onhangup, options) {

  return new exports.Client(wsuri, onconnect, onhangup, options);
}

/**
 * debug configuration
 * does nothing, just to keep compat with AutoBahnJS
 *
 * @param {websocket.io} websocket
 * @param {Object} onconnect handler
 * @param {Object} onhangup handler
 * @param {Object} options
 * @api public
 */
exports.debug = function (debugWamp, debugWs) {
}


//Supports WORLIZE WebSocket-Node
/*
 * authorizationCB = function (request) - should return true if auth succeeds, false else
 * es.
 */
exports.attachWSN = function(server, authorizationCB, options) {
  var wamp = new exports.Server(options);

  server.on('request', function(request) {
    if (authorizationCB(request))
    {
      var client = request.accept('wamp', request.origin);
      wamp.onConnectionWSN(client);
    }
    else {
      request.reject();
      return;
    }
  });

  return wamp;
}
