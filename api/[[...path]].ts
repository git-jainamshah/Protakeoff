import 'dotenv/config';
import { createApp } from '../backend/src/app.js';
import serverlessHttp from 'serverless-http';

const app = createApp();

export default serverlessHttp(app);
