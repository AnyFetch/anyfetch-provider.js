# Cluestr file provider

NodeJS toolkit for creating [Cluestr](http://cluestr.com) providers.

## Introduction

If you want to add a new service to Cluestr (as a document entry point), you should use this tiny toolkit.

This toolkit enables you to bridge a given service to the cluestr api by mounting a server receiving calls from both side (ie. the service and Cluestr).

## Installation

`npm install cluestr-provider`

Then:

```javascript
// See syntax below
var server = CluestrProvider.createServer(configHash);
```

## Configuration hash
You need to specify some handlers and datas in the `configHash`.

### Datas
```javascript
configHash = {
  cluestrAppId: 'appId',
  cluestrAppSecret: 'appSecret',
  connectUrl: 'http://myprovider.example.org/init/connect'
  ...
};
```

* `cluestrAppId`: application id from Cluestr.
* `cluestrAppSecret`: application secret from Cluestr.
* `connectUrl`: redirect_uri registered on Cluestr.

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
* `res`: response to send. Use this to redirect the user to some OAuth confirmation page
* `next`: call this after filling `res`. First parameter is the error (if you want to abort), second parameter is the datas to store.

Example:
```javascript
var initAccount = function(req, res, next) {
  var preDatas = {
    accessGrant: accessGrant
  };
  next(null, preDatas);
};

#### `connectAccountRetrievePreDatas`
This function should return an object hash uniquely identifying the preDatas previously sent.
To build this hash, you can use `req` containing all datas about the current request (and possibly a callback code, the previous grant, ... depending on your OAuth provider).

> Please note : for now, you need to prefix each of your key with `data.`. This will probably be modified in the future.
> For instance `{'datas.accessGrant': req.params.code}`.

Params:
* `req`: the current request. Access GET values in `req.params`.
* `next`: call this with the error if any (your provider did not return a code, ...) and your identifier hash.

```javascript
var connectAccountRetrievePreDatas = function(req, next) {
  next({'datas.accessGrant': accessGrant}, next);
};
```

#### `connectAccountRetrieveAuthDatas`
This function will be called to retrieve a set of datas to store permanently.
Store your tokens (refresh tokens, access tokens) or any other informations.

```javascript
var connectAccountRetrieveAuthDatas = function(req, res, preDatas, next) {
  var datas = preDatas.accessGrant + "_accessToken";
  next(null, datas, 'http://myprovider.example.org/config');
};
```

var updateAccount = function(datas, next) {
  // Update the account !
  next();
};

var queueWorker = function(task, cb) {
  // Upload document
  cb();
};
