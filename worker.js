'use strict';

const Promise = require('bluebird');

const debug = require('debug')('strider-bundler:worker');

function toStriderProxy(instance) {
  const functionsInInstance = Object.getOwnPropertyNames(Object.getPrototypeOf(instance)).filter(propertyName => {
    return typeof instance[propertyName] === 'function' && propertyName !== 'constructor';
  });

  functionsInInstance.forEach(functionInInstance => {
    instance[`${functionInInstance}Async`] = instance[functionInInstance];
    instance[functionInInstance] = function () {
      const args = Array.from(arguments);
      const done = args.pop();
      return instance[`${functionInInstance}Async`].apply(instance, args)
        .then(result => done(null, result))
        .catch(error => done(error));
    };
    Object.defineProperty(instance[functionInInstance], 'length', {
      value: instance[`${functionInInstance}Async`].length
    });
  });

  return instance;
}

class BundlerPhaseWorker {
  constructor(config, job) {
    debug('Constructing phase worker for strider-bundler…');

    this.config = config;
    this.job = job;

    // Example: Setting an environment variable
    this.env = {
      'BUNDLER_ACTIVE': true
    };

    // Example: Static command definition for a phase
    this.environment = 'echo This job will be processed by strider-bundler';
  }

  // Run this function in the deploy phase.
  deploy(context) {
    debug('Starting bundling process…');
    context.comment('Starting bundling process…');

    const contextCmd = Promise.promisify(context.cmd);

    return contextCmd({
      command: 'tar',
      args: ['--create', '--verbose', '--gzip', `--directory=${this.config.bundleDirectory}`, '--file=package.tgz', '.']
    })
      .then(() => {
        context.comment('Bundle created as package.tgz.');
      });
  }
}

class BundlerInit {
  init(config, job, context) {
    debug('Initiliazing strider-bundler…');
    return Promise.resolve(toStriderProxy(new BundlerPhaseWorker(config, job)));
  }
}

module.exports = toStriderProxy(new BundlerInit());
