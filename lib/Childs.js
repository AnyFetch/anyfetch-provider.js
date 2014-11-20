'use strict';

var async = require('async');
var util = require('util');
var events = require('events');
var fork = require('child_process').fork;

var logError = require('./util.js').logError;

function Child(data) {
  Child.id = Child.id || 0;

  this.id = Child.id;
  Child.id += 1;

  this.process = null;
  this.killed = false;

  this.data = data;
  this.createNewProcess();
}

util.inherits(Child, events.EventEmitter);

Child.prototype.createNewProcess = function createNewProcess() {
  this.process = fork(__dirname + '/child-process.js');

  var self = this;
  this.process.on('message', function(data) {
    if(data.err) {
      data.err = new Error(data.err);
      data.err.stack = data.errStack;

      delete data.errStack;
    }

    self.emit('message', data);
  });

  this.process.on('exit', function(code) {
    if(self.killed) {
      return;
    }

    if(code === 0) {
      return self.emit('stop', self);
    }

    console.log("Child process crash! Restarting it!");

    self.createNewProcess();
    self.start();
  });
};

Child.prototype.start = function start() {
  this.process.send(this.data);
};

function Childs(nb, data) {
  this.childs = {};

  var self = this;
  for(var i = 0; i < nb; i += 1) {
    var child = new Child(data);

    child.on('message', function(data) {
      self.emit('message', data);
    });

    child.on('error', function(err) {
      self.removeChild(child);
      logError(err);
    });

    child.on('stop', function() {
      self.removeChild(child);
    });

    this.childs[child.id] = child;
  }
}

util.inherits(Childs, events.EventEmitter);

Childs.prototype.removeChild = function removeChild(child) {
  this.childs[child.id].process.removeAllListeners();
  this.childs[child.id].removeAllListeners();

  delete this.childs[child.id];
  this.checkEmpty();
};

Childs.prototype.start = function start() {
  var self = this;
  Object.keys(this.childs).forEach(function(id) {
    self.childs[id].start();
  });
};

Childs.prototype.kill = function kill(cb) {
  var self = this;
  async.each(Object.keys(this.childs), function(childId, cb) {
    self.childs[childId].killed = true;

    self.childs[childId].process.on('disconnect', function() {
      cb();
      cb = function() {};
    });

    self.childs[childId].on('stop', function() {
      cb();
      cb = function() {};
    });

    self.childs[childId].process.kill('SIGTERM');
  }, function() {
    self.emit('kill');
    cb();
  });
};

Childs.prototype.checkEmpty = function checkEmpty() {
  if(Object.keys(this.childs).length === 0) {
    return this.emit('stop');
  }
};

module.exports = Childs;
