import axios from 'axios';

export const api = axios.create({ baseURL: '/api', timeout: 15000 });
export const createTicket = async (data) => (await api.post('/tickets', data)).data.data;
export const updateTicket = async (id, data) => (await api.patch(`/tickets/${id}`, data)).data.data;
export function errorMessage(error) {
  return error.response?.data?.error?.message || 'We couldn’t reach the server. Check your connection and try again.';
}
