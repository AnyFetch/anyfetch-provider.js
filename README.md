AnyFetch provider
======================

[![Build Status](https://travis-ci.org/Papiel/anyfetch-provider.js.png?branch=master)](https://travis-ci.org/Papiel/anyfetch-provider.js)[![Dependency Status](https://gemnasium.com/Papiel/anyfetch-provider.js.png)](https://gemnasium.com/Papiel/anyfetch-provider.js)
[![Coverage Status](https://coveralls.io/repos/Papiel/cluestr-provider/badge.png?branch=master)](https://coveralls.io/r/Papiel/cluestr-provider?branch=master)
[![NPM version](https://badge.fury.io/js/anyfetch-provider.png)](http://badge.fury.io/js/anyfetch-provider)

NodeJS toolkit for creating [anyFetch](http://anyfetch.com) providers.

## Introduction

If you want to add a new service to AnyFetch (as a document entry point), you should use this tiny toolkit.

This toolkit enables you to bridge a given service to the anyfetch api by mounting a server receiving calls from both side (ie. the service and AnyFetch).

Use [Provider boilerplate](https://github.com/Papiel/provider-boilerplate) to generate a new project stub.

## Installation

`npm install anyfetch-provider`

Then:

```javascript
// See syntax below
var server = AnyFetchProvider.createServer(configHash);
```

## Configuration hash
You need to specify some handlers and datas in the `configHash`.

### Datas
```javascript
configHash = {
  anyfetchAppId: 'appId',
  anyfetchAppSecret: 'appSecret',
  connectUrl: 'http://myprovider.example.org/init/connect',
  ...
};
```

* `anyfetchAppId`: application id from AnyFetch.
* `anyfetchAppSecret`: application secret from AnyFetch.
* `connectUrl`: redirect_uri registered on AnyFetch.

### Handlers

```javascript
configHash = {
   ...
  initAccount: initAccount,
  connectAccountRetrievePreDatas: connectAccountRetrievePreDatas,
  connectAccountRetrieveAuthDatas: connectAccountRetrieveAuthDatas,
  updateAccount: updateAccount,
  queueWorker: queueWorker,
};
```

#### `initAccount`
Called when connecting an account for the first time.
This function is responsible to store pre-datas (authorization grant, temporary values) and redirecting to another page.

Params:
* `req`: the current request
* `next`: call this after filling `res`. First parameter is the error (if you want to abort), second parameter is the datas to store, third parameter the page where the user should be redirected

Example:
```javascript
var initAccount = function(req, res, next) {
  var preDatas = {
    accessGrant: accessGrant
  };

  var redirectUrl = "http://myprovider.example.org/authorize";
  next(null, preDatas, redirectUrl);
};
```

#### `connectAccountRetrievePreDatasIdentifier`
This function should return an object hash uniquely identifying the preDatas previously sent.
To build this hash, you can use `req` containing all datas about the current request (and possibly a callback code, the previous grant, ... depending on your OAuth provider).

> Please note : for now, you need to prefix each of your key with `data.`. This will probably be modified in the future.
> For instance `{'datas.accessGrant': req.params.code}`.

Params:
* `req`: the current request. Access GET values in `req.params`.
* `next`: call this with the error if any (your provider did not return a code, ...) and your identifier hash.

Example:
```javascript
var connectAccountRetrievePreDatasIdentifier = function(req, next) {
  next({'datas.accessGrant': accessGrant}, next);
};
```

#### `connectAccountRetrieveAuthDatas`
This function will be called to retrieve a set of datas to store permanently.
Store your tokens (refresh tokens, access tokens) or any other informations.

Params:
* `req`: the current request. Access GET values in `req.params`.
* `preDatas` datas stored previously, as returned by `initAccount`
* `next`: call this with the error if any (token is invalid, preDatas are out of date, ...) and the datas to store permanently. Third parameter can optionally be the redirect page, if blank it will be `anyfetch.com`.

Example:
```javascript
var connectAccountRetrieveAuthDatas = function(req, preDatas, next) {
  var datas = {
    refreshToken: retrieveRefreshToken()
  }
  next(null, datas);
};
```

#### `updateAccount`
This function will be called periodically to update documents. Calls will occur:
* when the user ping `/update` on AnyFetch API
* right after connecting the provider for the first time
* after a span of time, when AnyFetch server deems new datas can be gathered.

This function must return a list of task, each task being a document to create or update on AnyFetch.
This tasks will be fed to `queueWorker` (see below).
The function must also return a cursor (for instance, the current date) to remember the state and start upload from this point next time.


Params:
* `datas`: datas stored by `connectAccountRetrieveAuthDatas`
* `cursor`: last cursor, or null on first run.
* `next`: call this with the error if any (grant has been revoked, ...), the list of tasks to feed to `queueWorker` and the new cursor (it will be written after all tasks are processed).

```javascript
var updateAccount = function(datas, cursor, next) {
  // Update the account !
  var tasks = [
    { 'url': 'http://...', 'token': '...'},
    { 'url': 'http://...', 'token': '...'}
  ];

  next(null, tasks, new Date());
};
```

##### Sending in multiple times
Sometimes, to send big chunks of datas, you may need to send a first batch of tasks. To do this, just call `next` with an error and an array (without a new cursor). You can do this as many time as you like, once you're done just call next with the new cursor as third parameter.

```javascript
// For big tasks (multiple gigabytes of datas / asynchronous retrieval of tasks /...)
var updateAccount = function(datas, cursor, next) {
  // Update the account !
  var tasks1 = [...];
  next(null, tasks1);

  var tasks2 = [...];
  next(null, tasks2);

  var tasks3 = [...];
  next(null, tasks3, new Date());
  // Warning; once a call to next with a new cursor has been made, you can't queue anymore.
};
```
##### Updating your datas
Some providers update their tokens with time, or have one-time-use refresh tokens.
To handle such a case, you can use a fourth parameter which is a function to update your datas.
All tasks pushed after the call to this function will use the new datas.

```javascript
var updateAccount = function(datas, cursor, next, updateDatas) {
  datas.newKey = "newValue";
  updateDatas(datas, function(err, newDatas) {
    // Update the account !
    var tasks1 = [...];
    next(null, tasks1);
  });
};
```

#### `queueWorker`
This function will be called with each task returned by `updateAccount`.
It must send the document to AnyFetch using the client available on `anyfetchClient`.

Params:
* `task` the task defined previously.
* `anyfetchClient` pre-configured client for upload (with appId, appSecret and accessToken)
* `datas` datas for the account being updated
* `cb` call this once document is uploaded and you're ready for another task

```javascript
var queueWorker = function(task, anyfetchClient, datas, cb) {
  // Upload document
  anyfetchClient.sendDocument(task, cb);
};
```

### Simple use
For most use case, you'll be able to simplify the initial `initAccount` / `connectAccountRetrievePreDatasIdentifier` / `connectAccountRetrieveAuthDatas`.

You'll simply have to:
* Use `{code: req.params.code}` as `preDatas` (second argument of `initAccount` `next()` function)
* Return a `redirectUrl` (third argument of `initAccount` `next()` function) including this code param for later retrieval. Most OAuth provider will let you use a `?state=` parameter to forward datas between initialization and validation.
* Return `{'datas.code': req.params.state}` (replace `state` with whatever way you have to remember the initial code) as the `preDatasIdentifier` (second argument of  `connectAccountRetrievePreDatasIdentifier` `next()` function). Remember : this object serves as a simple identifier to retrieve the datas you stored before, but in this simple use case we didn't store additional datas over the `code` parameter.
* Return final credentials in `datas` (second argument of `connectAccountRetrieveAuthDatas` `next()`)

### Optional parameters

* `concurrency` : number of tasks to run simultaneously on `queueWorker`, default is 1.
* `redirectUrl` : url where the user should be redirected after `connectAccountRetrieveAuthDatas` (on /init/callback)

## Register additional endpoints
Sometimes, you'll need to define additional endpoints -- for example to receive push notifications from your provider.
To do so, you can simply plug new routes onto the `server` object. Behind the scenes, it is a simple customised `restify` server.

For instance:
```javascript
var server = AnyFetchProvider.createServer(configHash);
server.post('/delta', function(req, res, next) {
  AnyFetchProvider.retrieveDatas({'datas.account_id': req.params.account_id}, function(err, datas) {
    ...
});
})
```

## Helper functions
### `retrieveDatas(hash, function(err, datas))`
Retrieve datas associated with the `hash`. `hash` must be a unique identifier in all account.
You'll need to prefix the key with `datas.` to search in your datas.

### `debug.cleanTokens(cb)`
Crean all token and temp tokens, use as `before()` for Mocha tests.

### `debug.createToken(hash, cb)`
Create a Token Mongoose model.

### `debug.createTempToken(hash, cb)`
Create TempToken Mongoose model.
