# Cluestr file provider

NodeJS toolkit for creating [Cluestr](http://cluestr.com) providers.

## Introduction

If you want to add a new service to Cluestr (as a document entry point), you should use this tiny toolkit.

This toolkit enables you to bridge a given service to the cluestr api by mounting a server receiving calls from both side (ie. the service and Cluestr).

## Installation

`npm install cluestr-provider`

## Getting started

Here is a simple example :

```javascript
// 1. Require
var Provider = require('cluestr-provider');

// 2. Create post-hooks functions
var all = function (uuid) { // Send everything for the first time or again to cluestr
  // Always send the same thing
};
```
