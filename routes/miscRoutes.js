import express from 'express';
import { sendContactEmail } from '../controllers/helpController.js';

const router = express.Router();

router.post('/contact', sendContactEmail);

// router.post('/newsletter/subscribe', subscribeToNewsletter);
// router.get('/health-check', (req, res) => res.status(200).send('OK'));

export default router;
