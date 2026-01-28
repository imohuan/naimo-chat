class ChatService {
  async startSession(params: {
    message: string;
    mock?: boolean;
    session?: string;
    cwd?: string;
    eventName?: string;
  }) {
    const res = await fetch('/api/chat/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return res.json();
  }

  async abortSession(streamingId: string) {
    const res = await fetch('/api/chat/abort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamingId })
    });
    return res.json();
  }

  async approvePermission(requestId: string) {
    const res = await fetch(`/api/chat/permissions/${requestId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' })
    });
    return res.json();
  }

  async denyPermission(requestId: string) {
    const res = await fetch(`/api/chat/permissions/${requestId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deny' })
    });
    return res.json();
  }

  async loadEvents() {
    const res = await fetch('/api/chat/events');
    return res.json();
  }

  async saveEvents(name: string, events: any[]) {
    const res = await fetch('/api/chat/events/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, events })
    });
    return res.json();
  }

  async deleteEvent(eventName: string) {
    const res = await fetch(`/api/chat/events/${eventName}`, {
      method: 'DELETE'
    });
    return res.json();
  }

  async loadProjects() {
    const res = await fetch('/api/chat/projects');
    return res.json();
  }

  async loadSession(projectId: string, sessionId: string) {
    const res = await fetch(`/api/chat/projects/${projectId}/sessions/${sessionId}`);
    return res.json();
  }

  async deleteSession(sessionId: string) {
    const res = await fetch(`/api/chat/sessions/${sessionId}`, {
      method: 'DELETE'
    });
    return res.json();
  }
}

export const chatService = new ChatService();
