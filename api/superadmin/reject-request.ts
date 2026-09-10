import type { Request, Response } from 'express';
import { registrationDecision } from './registration-decision.js';
export default function handler(req: Request, res: Response) { return registrationDecision(req, res, false); }
