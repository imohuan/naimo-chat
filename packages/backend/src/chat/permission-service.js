const { randomUUID } = require('crypto');

/**
 * Lightweight in-memory permission tracker used by the demo server.
 * Mirrors the basic shape of the cui-main permission flow:
 *  - /notify registers a pending request
 *  - /api/permissions lists/filter requests
 *  - /decision marks approved/denied and carries modified input or reason
 */
class PermissionService {
  constructor() {
    this.requests = new Map();
  }

  add(toolName, toolInput, streamingId = 'unknown') {
    const id = randomUUID();
    const request = {
      id,
      toolName,
      toolInput,
      streamingId,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };
    this.requests.set(id, request);
    return request;
  }

  list(filter = {}) {
    const { streamingId, status } = filter;
    return Array.from(this.requests.values()).filter((r) => {
      if (streamingId && r.streamingId !== streamingId) return false;
      if (status && r.status !== status) return false;
      return true;
    });
  }

  get(id) {
    return this.requests.get(id);
  }

  decide(id, action, options = {}) {
    const req = this.requests.get(id);
    if (!req || req.status !== 'pending') return null;
    if (action === 'approve') {
      req.status = 'approved';
      if (options.modifiedInput) req.modifiedInput = options.modifiedInput;
    } else if (action === 'deny') {
      req.status = 'denied';
      if (options.denyReason) req.denyReason = options.denyReason;
    } else {
      return null;
    }
    return req;
  }
}

module.exports = { PermissionService };
