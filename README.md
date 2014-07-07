AnyFetch provider
======================

[![Build Status](https://travis-ci.org/AnyFetch/anyfetch-provider.js.png?branch=master)](https://travis-ci.org/AnyFetch/anyfetch-provider.js)[![Dependency Status](https://gemnasium.com/AnyFetch/anyfetch-provider.js.png)](https://gemnasium.com/AnyFetch/anyfetch-provider.js)
[![Coverage Status](https://coveralls.io/repos/AnyFetch/anyfetch-provider.js/badge.png?branch=master)](https://coveralls.io/r/AnyFetch/anyfetch-provider.js?branch=master)
[![NPM version](https://badge.fury.io/js/anyfetch-provider.png)](http://badge.fury.io/js/anyfetch-provider)

NodeJS toolkit for creating [anyFetch](http://anyfetch.com) providers.

## Introduction
If you want to add a new service to AnyFetch (as a document entry point), you should use this tiny toolkit.

This toolkit lets you bridge a given service to the anyFetch api by mounting a server receiving calls from both sides (ie. the service and AnyFetch).

Use [Provider boilerplate](https://github.com/AnyFetch/provider-boilerplate) to generate a new project stub.

## Installation and documentation

`npm install anyfetch-provider`

Here is a sample use:

```javascript
// See syntax below
var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, workers, config);
```

## Parameters
> Too lazy to read the doc? Why not check out real use-case from open-source code! For a simple use case, take a look on this file from the [Google Contacts provider](https://github.com/AnyFetch/gcontacts.provider.anyfetch.com/blob/master/lib/index.js). For more advanced use-case with file upload, see [Dropbox provider](https://github.com/AnyFetch/dropbox.provider.anyfetch.com/blob/master/lib/index.js).

## `connectFunctions`
The first parameter to `AnyFetchProvider.createServer()` is a set of functions handling the OAuth part on the provider side (the OAuth part on Anyfetch side is automatically handled for you by the lib).

```
var connectFunctions = {
  // IN :
  //   * callback url to ping after grant
  // OUT :
  //   * err
  //   * url to redirect to
  //   * data to store (if any)
  redirectToService: function redirectToService(callbackUrl, cb) {
    serviceLib.generateRedirectUrl(function(err, redirectUrl) {
      redirectUrl += "&callback=" + encodeURI(callbackUrl);
      cb(null, redirectUrl, {
        token: '123'
      });
    });
  },

  // IN :
  //   * GET params from the incoming request,
  //   * Params returned by previous function
  // OUT :
  //   * err
  //   * service data to permanently store
  retrieveTokens: function retrieveTokens(reqParams, storedParams, cb) {
    serviceLib.generateAccessToken(reqParams.code, function(err, accessToken) {
      cb(null, accountName, {
        accessToken: accessToken,
        account: storedParams.account
      });
    });
  }
};
```

The first function, `redirectToService` will be invoked when a user asks to connect his AnyFetch account with your provider. It is responsible for redirecting the user to your provider consent page.

It takes as parameter a `callbackUrl` (of the form `https://your.provider.address/init/callback`). It is up to you to ensure the user is redirected to this URL after giving consent on the `redirectUrl` page.
The second parameter of the `cb` can be data that need to be stored. The lib will reinject this data on its next call to `retrieveTokens` (in `storedParams`). 

The second function, `retrieveTokens`, will be invoked when the user has given his permission.

It takes as parameter a `reqParams` object, which contain all GET params sent to the previous `callbackUrl`. It will also get access in `storedParams` to data you sent to the first callback.
You're responsible for invoking the `cb` with any error, the account name from the user and all the final data you wish to store internally -- in most case, this will include at least a refresh token, but this can be anything as long as it's an object.

## `updateAccount`
This function will be invoked when the user asks to update his account with new data.

In order to do so, a `cursor` parameter is sent -- you'll return it at the end of the function, updated, to match the new state (either an internal cursor sent from your provider, or the current date)

```js
// IN :
//   * serviceData returned by retrieveTokens
//   * last cursor returned by this function, or null
//   * Queues to use
// OUT :
//   * err
//   * new cursor
//   * new serviceData to replace previous ones (if any)
var updateAccount = function updateAccount(serviceData, cursor, queues, cb) {
  serviceLib.retrieveDelta(cursor, function(err, createdFiles, deletedFiles) {
    createdFiles.forEach(function(task) {
      queues.additions.push(task);
    });

    deletedFiles.forEach(function(task) {
      queues.deletions.push(task);
    });

    cb();
  });
};
```

It takes as parameter the data you sent to `retrieveTokens`, the `cursor` that was sent during the last invokation of `updateAccount` or `null` if this is the first run.

You can then start pushing tasks onto the different queues -- more on that on next section.


## `config`
The last parameters to `AnyFetchProvider.createServer()` is an object containing your application keys. You can find them on [the AnyFetch manager](https://manager.anyfetch.com).

```
var config = {
  // Anyfetch app id
  appId: "your_app_id",

  // Anyfetch app secret
  appSecret: "your_app_secret",

  // Server currently running
  providerUrl: "https://your.provider.address"
};
```
