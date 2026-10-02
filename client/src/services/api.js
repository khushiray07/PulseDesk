import axios from 'axios';

export const api = axios.create({ baseURL: '/api', timeout: 15000 });
export const createTicket = async (data) => (await api.post('/tickets', data)).data.data;
export const updateTicket = async (id, data) => (await api.patch(`/tickets/${id}`, data)).data.data;
export const uploadAttachment = async (id, file) => {
  const body = new FormData();
  body.append('file', file);
  return (await api.post(`/tickets/${id}/attachments`, body, { timeout: 30000 })).data.data;
};
export const deleteAttachment = async (id, attachmentId) => (await api.delete(`/tickets/${id}/attachments/${attachmentId}`)).data.data;
export const attachmentContentUrl = (id, attachmentId, download = false) => `/api/tickets/${id}/attachments/${attachmentId}/content${download ? '?download=1' : ''}`;
export function errorMessage(error) {
  return error.response?.data?.error?.message || 'We couldn’t reach the server. Check your connection and try again.';
}
