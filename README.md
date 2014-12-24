AnyFetch provider
======================

[![Circle CI](https://circleci.com/gh/AnyFetch/anyfetch-provider.js.svg?style=svg)](https://circleci.com/gh/AnyFetch/anyfetch-provider.js)[![Dependency Status](https://gemnasium.com/AnyFetch/anyfetch-provider.js.png)](https://gemnasium.com/AnyFetch/anyfetch-provider.js)
[![Coverage Status](https://coveralls.io/repos/AnyFetch/anyfetch-provider.js/badge.png?branch=master)](https://coveralls.io/r/AnyFetch/anyfetch-provider.js?branch=master)
[![NPM version](https://badge.fury.io/js/anyfetch-provider.png)](http://badge.fury.io/js/anyfetch-provider)

NodeJS toolkit for creating [anyFetch](http://anyfetch.com) providers.

## Introduction
If you want to add a new service to AnyFetch (as a document entry point), you should use this tiny toolkit.

This let you bridge a given service to the anyFetch api by mounting a server receiving calls from both sides (the service and AnyFetch API).

Use [Provider boilerplate](https://github.com/AnyFetch/provider-boilerplate) to generate a new project stub.

## Installation and documentation

`npm install anyfetch-provider`

Here is a sample usage:

```js
// See syntax below
var server = AnyFetchProvider.createServer(connectFunctions, __dirname + '/lib/workers.js', __dirname + '/lib/update.js', config);

server.listen();
```

### Parameters
> Too lazy to read the doc? Why not check out real use-case from open-source code! For a simple use case, take a look on this file from the [Google Contacts provider](https://github.com/AnyFetch/gcontacts.provider.anyfetch.com/blob/master/lib/index.js). For more advanced use-case with file upload, see [Dropbox provider](https://github.com/AnyFetch/dropbox.provider.anyfetch.com/blob/master/lib/index.js).

#### `connectFunctions`
The first parameter to pass to `AnyFetchProvider.createServer()` is a set of functions handling the OAuth part on the provider side (the OAuth flow on Anyfetch side is automatically handled for you by the lib).

```js
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

      var dataToStore = {
        foo: 'bar'
      };

      cb(null, redirectUrl, dataToStore);
    });
  },

  // IN :
  //   * GET params from the incoming request (probably the result from a consent screen),
  //   * Params returned by previous function redirectToService
  // OUT :
  //   * err
  //   * account name, current account identifier on the service (email address from the user for instance)
  //   * service data to permanently store
  retrieveTokens: function retrieveTokens(reqParams, storedParams, cb) {
    serviceLib.generateAccessToken(reqParams.code, function(err, accessToken) {
      serviceLib.retrieveUserEmail(accessToken, function(err, userEmail) {
        cb(null, userEmail, {
          accessToken: accessToken,
          account: storedParams.account
        });
      });
    });
  }
};
```

The first function, `redirectToService` will be invoked when a user asks to connect his AnyFetch account with your provider. It is responsible for providing an URL to your provider consent page.

It takes as parameter a `callbackUrl` (of the form `https://your.provider.address/init/callback`). It is up to you to ensure the user is redirected to this URL after giving consent on the `redirectUrl` page.
The second parameter of the `cb` can be data that needs to be stored. The lib will reinject this data on its next call to `retrieveTokens` (in `storedParams`).

> This behavior can be useful when you need to store `code` or `requestTokens`. In most of the case however, you're safe to leave this empty.

The second function, `retrieveTokens`, will be invoked when the user has given his permission.

It takes as parameter a `reqParams` object, which contain all GET params sent to the previous `callbackUrl`. It will also get access in `storedParams` to data you sent to the callback in `redirectToService`.
You're responsible for invoking the `cb` with any error, the account name from the user and all the final data you wish to store internally—in most case, this will include at least a refresh token, but this can be anything as long as it's a valid JavasScript object.

> Warning: Final data can't contain a documentsPerUpdate property. It will be overwrite by the documents_per_update HTTP parameter.

#### `updateAccount`
This function (which must be directly exported in the file sent to `AnyFetchProvider.createServer()`) will be invoked whenever the user asks to update his account with new data from your provider.

In order to do so, a `cursor` parameter is sent—you'll return it at the end of the function, updated, to match the new state (either an internal cursor sent from your provider, or the current date, whichever suits you).

```js
// IN :
//   * serviceData returned by retrieveTokens
//   * last cursor returned by this function, or null on the first update
//   * Queues to use
// OUT :
//   * err
//   * new cursor
//   * new serviceData to replace previous ones (if any)
module.exports = function updateAccount(serviceData, cursor, queues, cb) {
  serviceLib.retrieveDelta(cursor, function(err, createdFiles, deletedFiles) {
    // Push new tasks onto the workers
    createdFiles.forEach(function(task) {
      queues.additions.push(task);
    });

    deletedFiles.forEach(function(task) {
      queues.deletions.push(task);
    });

    // Save new cursor
    cb(null, new Date().toString());
  });
};
```

It takes as parameter the data you sent to `retrieveTokens`, the `cursor` that was sent during the last invokation of `updateAccount` or `null` if this is the first run.

You can then start pushing tasks onto the different queues—more on that on next section.

#### `workers`
Workers (exported in the file sent to `AnyFetchProvider.createServer()`) are functions responsible for handling the tasks returned by `updateAccount`. Keep in mind they are shared for all users of your lib, and should therefore not rely on any external state or context.

`workers` must be an object where each key is a specific worker with specific options. For nearly all use-cases, you'll only need two workers: one for additions (sending new and updated documents from your provider to AnyFetch) and one for deletions (deleting documents onto AnyFetch).

A worker is a simple function taking two parameters: a job, and a `cb` to invoke with an error if any.

```js
// IN :
//   * job, with preconfigured keys:
//     * task: data to process
//     * anyfetchClient: pre-configured client, see https://github.com/AnyFetch/anyfetch.js
//     * serviceData: as returned by retrieveTokens, or updated by updateAccount (third optional parameter for cb)
//     * cache: a LRU cache, see https://github.com/isaacs/node-lru-cache
// OUT :
//   * err
var workers = {
  'additions': function(job, cb) {
    job.anyfetchClient.postDocument(job.task, cb);
  },
  'deletions': function(job, cb) {
    job.anyfetchClient.deleteDocumentById(job.task.id, cb);
  }
};

module.exports = workers;
```

The `job` parameter contains 4 keys:

* `task`: the task sent by your `updateAccount` function,
* `anyfetchClient`: a pre-configured [anyfetch client](https://github.com/AnyFetch/anyfetch.js), with simple functions to send documents and files to the API.
* `serviceData`: the data you've registered for this access token.
* `cache`: a pre-configured [LRU cache](https://github.com/isaacs/node-lru-cache)

`cb` does not take any additional params after the error.

> Note: Those workers are internally called as OS subprocesses by the lib, to ensure the failure of one worker does not bring down the whole server; it also avoids memory leaks from your code, since the workers are "cleaned" between each user.

#### `config`
The last parameter to `AnyFetchProvider.createServer()` is an object containing your application keys. You can find them on [the AnyFetch manager](https://manager.anyfetch.com).

```js
var config = {
  // Anyfetch app id
  appId: "your_app_id",

  // Anyfetch app secret
  appSecret: "your_app_secret",

  // Server currently running
  providerUrl: "https://your.provider.address/"
};
```

##### Faster?
You can set the concurrency—the number of parallel tasks per user that will be running to unstack all tasks. Default is 1, but you can increase this value using the `config.concurrency` property:

```js
// Set concurrency. Defaults to 1 when unspecified.
config.concurrency = 10;
```

You can also set the number of users processing in parallel by setting the `config.usersConcurrency` property.

> Note: as stated before, workers are doing their job in subprocesses. High concurrency means many small process running in parallel. The total number of tasks running in parallel will be `concurrency × usersConcurrency`.

### Going further...
#### Adding endpoints
`AnyFetchProvider.createServer()` returns a [restify](http://mcavage.me/node-restify/) server. This is very similar to express, and you can simply add endpoints; for instance:

```js
var server = AnyFetchProvider.createServer(connectFunctions, updateAccount, workers, config);

server.get('/hello', function(req, req, next) {
  res.send("Hello " + req.params.name);
  next();
});

server.listen();
```


#### Configuring Mongo and Redis
By default, the lib will read values from `process.env.MONGO_URL` and `process.env.REDIS_URL` to connect to external services. You can override this behavior using `config.redisUrl` and `config.mongoUrl`.
