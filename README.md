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
  connectAccountRetrieveTempToken: connectAccountRetrieveTempToken,
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

#### `connectAccountRetrieveTempToken`
This function should return 
var connectAccountRetrieveTempToken = function(req, res, TempToken, next) {
  // Retrieve temp token
  TempToken.findOne({'datas.accessGrant': accessGrant}, next);
};

var connectAccountRetrieveAuthDatas = function(req, res, preDatas, next) {
  var datas = preDatas.accessGrant + "_accessToken";
  next(null, datas, 'http://myprovider.example.org/config');
};

var updateAccount = function(datas, next) {
  // Update the account !
  next();
};

var queueWorker = function(task, cb) {
  // Upload document
  cb();
};
