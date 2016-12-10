'use strict';

const consul = require('consul');
const _Promise = require('bluebird');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8500;

/**
 * Creates a ZhikeConsul instance
 * @constructor
 * @param {(number|string)} [port=8500]
 * @param {(string)} [host=localhost]
 * @param {(array)}  [keys=[c1, c2]]
 * @param{(object)}  [ref=global]
 */
function ZhikeConsul(keys, host, port, ref) {
  if (!keys) {
    throw new Error('arguments must have configKeys');
  }

  // CFG应该挂到全局上
  ref = ref || global;

  host = host || DEFAULT_HOST;
  port = port || DEFAULT_HOST;

  // 检查CFG是否存在
  if (ref.CFG) {
    throw new Error('please make sure that ref.CFG was not exist');
  }

  if(!(this instanceof ZhikeConsul)) {
    return new ZhikeConsul(keys, host, port, ref);
  }

  this.keys = keys;
  this.host = host;
  this.port = port;
  this.consul = consul({
    host: this.host,
    port: this.port,
    promisify: true
  });

  // 初始化CFG为空对象
  this.ref = ref;
  this.ref.CFG = {};
  this.ref.config = {};
}

/**
 * Pull configs from origin server
 * @param {String} env 环境，如development、test或production
 */
ZhikeConsul.prototype.pull = _Promise.coroutine(function*(env) {
  env = env || 'development';
  for (let i = 0; i < this.keys.length; i++) {
    let key = this.keys[i];
    let data = yield this.consul.kv.get(key);
    if (data === undefined) {
      throw new Error(`config of ${key} does not exist`);
    }
    let value = JSON.parse(data.Value)[env];
    let assign = {};
    if (key.indexOf('Private') === -1) {
      assign[key] = value;
    } else {
      assign = value;
    }
    this.ref.CFG[key] = value;
    this.ref.config = Object.assign(this.ref.config, assign);
  }
  return {
    CFG: this.ref.CFG,
    config: this.ref.config
  }
});

/**
 * Register current service
 */
ZhikeConsul.prototype.register = function(data) {
  return this.consul.agent.service.register(data);
}

/**
 * Deregister current service
 */
ZhikeConsul.prototype.deregister = function(data) {
  return this.consul.agent.service.deregister(data);
}

/**
 * Get origin node's IP
 */
ZhikeConsul.prototype.getNodeIp = _Promise.coroutine(function*() {
  let nodes = yield this.consul.catalog.node.list();
  if (nodes.length === 0) {
    throw new Error('no nodes list');
  }
  return nodes[0]['Address'];
});

module.exports = ZhikeConsul;
