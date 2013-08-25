
/*!
 *  wamp.io: a node.js WAMP(c) server
 *  Client request handlers.
 *
 *  Copyright (c) 2012 Nico Kaiser <nico@kaiser.me>
 *  Copyright (c) 2013 Neville Franks <neville.franks@gmail.com>
 *  MIT Licensed
 *
 *	Last change: NF 2/08/2013 3:51:15 PM
 */

"use strict";
 
/** Module dependencies.
 */
var protocol = require('./protocol')
  , prefixes = require('./prefixes');

var mlog = require('minilog')('wamp_handlers');

var handlers = {};

/** Prefix Message
 *
 *  @param {wsio.Connection}Â client
 *  @param {Array} args prefix, uri
 */
handlers[protocol.TYPE_ID_PREFIX] = function(client, args) {
    prefix = args.shift();
    uri = args.shift();
    client.prefixes[prefix] = uri;
};


/** (RPC) Call Message
 *
 *  @param {wsio.Connection} a client
 *  @param {Array} args callId, procUri, ...
 */
handlers[protocol.TYPE_ID_CALL] = function( client, args ){
    var callId = args.shift(),
        procUri = args.shift();

    prefixes.resolveOrPass( procUri );
    args = args || [];
  
    // Callback function
    // @param error (string) if !null identifies the error. It is a URI or CURIE. ref: http://wamp.ws/spec#callerror_message
    // @param result (string or obj) if error is null it spec's the rpc result, else errorDesc.
    // @param errorDetails (obj) used if error is !null and it MUST be not null, and is used to communicate application error details, defined by the error.
    var cb = function( error, result, errorDetails ){
        var msg;
        if ( error ){   // Updated to match WAMP spec. ref: http://wamp.ws/spec#callerror_message NF 16/07/2013
            msg = [ protocol.TYPE_ID_CALL_ERROR, callId, error.toString(), result ? result.toString() : '', errorDetails ];
        } else {
            msg = [ protocol.TYPE_ID_CALL_RESULT, callId, result ];
        }
        // debug( 'Server.rpc() ' + procUri + '() send msg:', msg, JSON.stringify( msg ) );  // TODO: Mismatch for error case return info and Autobahn client needs to be resolved. NF 17/07/2013
        client.send( JSON.stringify( msg ) );
    };
  
    // If a RPC function procURI exists call it, else emit('call'...)
    var rpcinfo = this.rpcExists( procUri, args );  // <A NAME="handler.rpc"> NF added 10/07/2013
    if ( rpcinfo.exists ){
        try{   // See use of when.then.otherwise() below. Probably best to loose try - catch. TODO: 24/07/2013 Nope. We can get exceptions that .otherwise() doesn't handle. 31/07/2013
            this.rpc( procUri, client, args ).then(
                function( reply ){
                    cb( null, reply );
                },
                function( error ){
                    // debug( 'Server.rpc() ' + procUri + '() call rejected. error:', error );
                    // TODO: log all errors to logentries & mlog.error(). 24/07/2013
                    // Check that the reject( error ) is error.error, error.errorDesc, [error.errorDetails].
                    if ( !error.error || !error.errorDesc ){
                        mlog.error( 'Server.rpc() reject( error ) param is invalid. error: ', error );
                        cb( 'RPC function ' + procUri + '() has invalid reject() params', '', error );   // Must fix such functions.
                    }else
                        cb( error.error, error.errorDesc, error.errorDetails );
                }
            ).otherwise( function( error ){  // Pick up any exceptions. Will only work for exceptions in top level of rpc func. ie. Outside of any promises it uses. Also can not work inside a rpc finc.
                mlog.error( 'RPC function ' + procUri + '() raised an otherwise() exception.' +  error );
                cb( 'RPC function ' + procUri + '() raised an otherwise() exception.', '', error );   // Must do cb() so client promise is rejected.
            });
        }
        catch( e ){
            mlog.error( 'In rpc handlers[] RPC function ' + procUri + '() raised an exception e:', e );
            cb( 'wamp handlers[CALL]', 'RPC function ' + procUri + '() raised an exception.', e.message );  // Must do cb() so client promise is rejected.
        }
    }
    else
        this.emit( 'call', procUri, client, args, cb );
        // NF: Updated to pass 'client' to call events. 5/07/2013
}


/** Subscribe Message
 *
 *  @param {wsio.Connection} a client
 *  @param {Array} args topicUri
 */
handlers[protocol.TYPE_ID_SUBSCRIBE] = function( client, args ){
    var topicUri = prefixes.resolveOrPass( args.shift() );
    this.topics[ topicUri ] || ( this.topics[ topicUri ] = {} );    // Add topic to Server if it doesn't exist.
    this.topics[topicUri][client.id] = true;    // let Server track that the client has subscribed to the topic.
    mlog.debug('subscribed client ' + client.id + ' for topic ' + topicUri);
    this.emit('subscribed', client.id, topicUri, args);
};


/** Unsubscribe Message
 *
 *  @param {wsio.Connection}Â client
 *  @param {Array} args topicUri
 */
handlers[protocol.TYPE_ID_UNSUBSCRIBE] = function( client, args ){

    // If topic spec'd - Unsubscribe client from the topic
    var topicUri = prefixes.resolveOrPass(args.shift());
    if ( topicUri ){
        delete this.topics[ topicUri ][ client.id ];
        mlog.debug( 'unsubscribed client ' + client.id + ' from topic ' + topicUri + ' this.topics[topicUri]:', this.topics[topicUri] );
    } else {
        // No topic spec'd - Unsubscribe client from all topics. NF: Autobahn.js doesn't provide this functionality and I have no idea why it was implemented! 8/07/2013
        self.unsubscribe( client );     // Untested new impl. NF 8/07/2013
        mlog.debug( 'unsubscribed client ' + client.id + ' from all topics' + ' this.topics[topicUri]:', this.topics[topicUri] );
        this.emit('unsubscribed', client.id, topicUri, args);
    }
}


/** Publish Message. Client request.
 *  @see Server.publish() for flip-side.
 *
 *  @param {wsio.Connection} a client
 *  @param {Array} args topicUri, event, excludeMe
 */
handlers[protocol.TYPE_ID_PUBLISH] = function( client, args ){
    var topicUri = prefixes.resolveOrPass( args.shift() ),
        event = args.shift(),
        excludeMe = args.shift();

    if ( typeof excludeMe === 'undefined' ){
        excludeMe = true;
    }
    var exclude = excludeMe ? client.id : undefined;
    this.publish( topicUri, event, exclude );
    mlog.debug('publish event ' + event + ' for topicUri ' + topicUri);
    this.emit( 'publish', client.id, event, topicUri, args );
}

module.exports = handlers;
