'use strict';

var async = require('async');
var util = require('util');
var events = require('events');
var fork = require('child_process').fork;

var logError = require('./util.js').logError;

function Child(file, data) {
  Child.id = Child.id || 0;

  this.id = Child.id;
  Child.id += 1;

  this.process = null;

  this.suicide = false;
  this.processing = false;

  this.data = data;
  this.file = file;

  this.createNewProcess();
}

util.inherits(Child, events.EventEmitter);


/**
 * Fork the current process, to shield the father (the current process) from crash
 */
Child.prototype.createNewProcess = function createNewProcess() {
  this.process = fork(this.file);

  var self = this;
  this.process.on('error', function(err) {
    logError(err);
    self.emit('stop', self, false);
  });

  this.process.on('message', function(data) {
    if(data.err) {
      data.err = new Error(data.err);
      data.err.stack = data.errStack;

      delete data.errStack;
    }

    if(data.type === 'state') {
      self.processing = data.processing;
      self.emit('state', self);
      return;
    }

    self.emit('message', data);
  });

  this.process.on('exit', function() {
    if(self.suicide) {
      return self.emit('stop', self, true);
    }

    console.log("Child process crash! Restarting it!");

    self.createNewProcess();
    self.start();
  });
};

Child.prototype.start = function start() {
  this.processing = true;
  this.process.send(this.data);
};

Child.prototype.stop = function stop() {
  this.suicide = true;
  this.process.kill('SIGTERM');
};

function Childs(nb, file, data) {
  this.childs = {};

  var self = this;
  for(var i = 0; i < nb; i += 1) {
    var child = new Child(file, data);

    child.on('message', function(data) {
      self.emit('message', data);
    });

    child.on('state', function() {
      var processingChilds = Object.keys(self.childs).filter(function(childId) {
        return self.childs[childId].processing;
      });

      if(processingChilds.length === 0) {
        self.stop();
      }
    });

    this.childs[child.id] = child;
  }
}

util.inherits(Childs, events.EventEmitter);

Childs.prototype.start = function start() {
  var self = this;

  Object.keys(this.childs).forEach(function(id) {
    self.childs[id].start();
  });

  self.emit('start');
};

Childs.prototype.stop = function stop() {
  var self = this;

  Object.keys(this.childs).forEach(function(childId) {
    self.childs[childId].stop();
  });

  self.emit('stop', false);
};

Childs.prototype.kill = function kill(cb) {
  var self = this;
  async.each(Object.keys(this.childs), function(childId, cb) {
    self.childs[childId].once('stop', function() {
      return cb();
    });

    self.childs[childId].stop();
  }, function() {
    self.emit('stop', true);
    cb();
  });
};

module.exports = Childs;
