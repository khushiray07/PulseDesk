import { listUsers } from '../services/user.service.js';

export async function getUsers(_req, res) {
  res.json({ success: true, data: await listUsers() });
}
