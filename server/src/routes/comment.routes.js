import { Router } from 'express';
import * as controller from '../controllers/comment.controller.js';

export const commentRouter = Router({ mergeParams: true });
commentRouter.get('/', controller.listComments);
commentRouter.post('/', controller.createComment);
