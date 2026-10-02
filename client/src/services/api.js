import axios from 'axios';

export const api = axios.create({ baseURL: '/api', timeout: 15000 });
let tokenRequest;
export function resetCsrfToken() { tokenRequest = undefined; }
api.interceptors.request.use(async (config) => {
  if (!['get', 'head', 'options'].includes(config.method || 'get')) {
    tokenRequest ??= api.get('/auth/csrf').then((response) => response.data.data.token)
      .catch((failure) => { tokenRequest = undefined; throw failure; });
    config.headers['X-CSRF-Token'] = await tokenRequest;
  }
  return config;
});
api.interceptors.response.use((response) => response, (failure) => {
  if (failure.response?.status === 401 && failure.config?.url !== '/auth/me') {
    resetCsrfToken(); window.dispatchEvent(new Event('pulsedesk:unauthorized'));
  }
  return Promise.reject(failure);
});
export const createTicket = async (data) => (await api.post('/tickets', data)).data.data;
export const updateTicket = async (id, data) => (await api.patch(`/tickets/${id}`, data)).data.data;
export const uploadAttachment = async (id, file) => {
  const body = new FormData();
  body.append('file', file);
  return (await api.post(`/tickets/${id}/attachments`, body, { timeout: 30000 })).data.data;
};
export const deleteAttachment = async (id, attachmentId) => (await api.delete(`/tickets/${id}/attachments/${attachmentId}`)).data.data;
export const attachmentContentUrl = (id, attachmentId, download = false) => `/api/tickets/${id}/attachments/${attachmentId}/content${download ? '?download=1' : ''}`;
export const addAssignee = async (id, userId) => (await api.post(`/tickets/${id}/assignees`, { userId })).data.data;
export const removeAssignee = async (id, userId) => (await api.delete(`/tickets/${id}/assignees/${userId}`)).data.data;
export const addComment = async (id, data) => (await api.post(`/tickets/${id}/comments`, data)).data.data;
export function errorMessage(error) {
  return error.response?.data?.error?.message || 'We couldn’t reach the server. Check your connection and try again.';
}
