import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { nanoid } from 'nanoid';
import { config } from './config.js';
import { errorHandler } from './lib/errors.js';
import { authRouter } from './modules/auth.js';
import { usersRouter } from './modules/users.js';
import { classesRouter } from './modules/classes.js';
import { examsRouter } from './modules/exams.js';
import { assignmentsRouter } from './modules/assignments.js';
import { attemptsRouter } from './modules/attempts.js';
import { gradingRouter } from './modules/grading.js';
import { reportsRouter } from './modules/reports.js';
import { organizationsRouter } from './modules/organizations.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const allowed = [config.webUrl, 'http://localhost:5173', 'http://localhost:5174'];
        cb(null, allowed.includes(origin));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.use((req, _res, next) => {
    (req as express.Request & { requestId: string }).requestId = `req_${nanoid(10)}`;
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true }));

  const api = express.Router();
  api.use(authRouter);
  api.use(usersRouter);
  api.use(classesRouter);
  api.use(examsRouter);
  api.use(assignmentsRouter);
  api.use(attemptsRouter);
  api.use(gradingRouter);
  api.use(reportsRouter);
  api.use(organizationsRouter);
  app.use('/api/v1', api);

  app.use(errorHandler);
  return app;
}
