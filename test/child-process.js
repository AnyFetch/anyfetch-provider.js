'use strict';

process.on('uncaughtException', function(err) {
  if(process.connected) {
    process.send({
      type: 'error',
      err: err.toString(),
      errStack: err.stack
    });
  }

  process.exit(1);
});

process.on('message', function(data) {
  if(data.exit) {
    return process.exit(0);
  }

  if(data.error) {
    throw new Error("Test error");
  }

  process.send({
    type: 'state',
    processing: data.processing
  });
});

process.on('SIGTERM', function() {
  process.disconnect();
  process.exit(0);
});
