'use strict';

/**
 * Minimal async job queue with global + per-user concurrency limits.
 */

class Queue {
  constructor({ concurrency = 2, perUser = 1, limit = 40 } = {}) {
    this.concurrency = concurrency;
    this.perUser = perUser;
    this.limit = limit;
    this.active = 0;
    this.pending = [];
    this.activeByUser = new Map();
  }

  get size() {
    return this.pending.length;
  }

  get running() {
    return this.active;
  }

  add(taskFn, { userId = 'anon' } = {}) {
    if (this.pending.length >= this.limit) {
      return Promise.reject(Object.assign(new Error('Antrean penuh, coba lagi sebentar.'), { code: 'QUEUE_FULL' }));
    }
    return new Promise((resolve, reject) => {
      this.pending.push({ taskFn, userId, resolve, reject });
      this.pump();
    });
  }

  pump() {
    while (this.active < this.concurrency && this.pending.length) {
      const idx = this.pending.findIndex((item) => (this.activeByUser.get(item.userId) || 0) < this.perUser);
      if (idx === -1) return;
      const item = this.pending.splice(idx, 1)[0];
      this.active += 1;
      this.activeByUser.set(item.userId, (this.activeByUser.get(item.userId) || 0) + 1);
      Promise.resolve()
        .then(() => item.taskFn())
        .then(item.resolve, item.reject)
        .finally(() => {
          this.active -= 1;
          const count = (this.activeByUser.get(item.userId) || 1) - 1;
          if (count <= 0) this.activeByUser.delete(item.userId);
          else this.activeByUser.set(item.userId, count);
          this.pump();
        });
    }
  }
}

module.exports = { Queue };
