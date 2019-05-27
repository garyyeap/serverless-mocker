import { MockerRouter } from './router';
import { ACTION } from '../constants/';
import { MockerResponse } from './response';

export class MockerServer {
  /**
   * Indicates which mode current server is running on
   *
   * @readonly
   * @type {boolean}
   */
  isLegacy = self === self.window;

  /**
   * Returns the Router instance of current server
   *
   * @readonly
   * @type {MockerRouter}
   */
  router = null;

  /**
   * Constructs a server object
   *
   * @param {string} [baseURL='/'] The base URL of all routes, default is '/'
   */
  constructor(baseURL = '/') {
    this.router = new MockerRouter(baseURL);
  }

  /**
   * Attach middleware to current server
   *
   * @param  {MiddlewareFn} fn Middleware function
   * @return {this}
   */
  use(fn) {
    this.router.use(fn);

    return this;
  }
}

// Event listeners MUST be added on the initial evaluation of worker scripts.
/* istanbul ignore next: unable to report coverage from sw context */
self.addEventListener('message', async (event) => {
  const {
    data,
    ports,
  } = event;

  if (!data || !ports || !ports.length) {
    return;
  }

  const port = ports[0];

  // handle connections
  switch (data.action) {
    case ACTION.PING:
      return port.postMessage({
        action: ACTION.PONG,
      });

    case ACTION.REQUEST_CLAIM:
      await self.clients.claim();
      return port.postMessage({
        action: ACTION.ESTABLISHED,
      });
  }
});

self.addEventListener('fetch', (event) => {
  const response = new MockerResponse(event);
  var resolved = false;

  // responeWith has to exec under sync mode
  event.respondWith(response._deferred.promise.then((res) => {
    resolved = true;
    return res;
  }));

  MockerRouter.routers.some((router) => {
    return router._match(event, response);
  });

  setTimeout(() => {
    if (resolved) return;
    resolved = true;

    fetch(event.request).then((res) => response._deferred.resolve(res));
  }, 2000);
});

// IE will somehow fires `activate` event on form elements
/* istanbul ignore if: unable to report coverage from sw context */
if (self !== self.window) {
  self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });
}
