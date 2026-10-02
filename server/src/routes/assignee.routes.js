import { Router } from 'express';
import * as controller from '../controllers/assignee.controller.js';

export const assigneeRouter = Router({ mergeParams: true });
assigneeRouter.get('/', controller.listAssignees);
assigneeRouter.post('/', controller.addAssignee);
assigneeRouter.delete('/:userId', controller.removeAssignee);
