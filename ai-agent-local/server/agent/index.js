import express from 'express';
import cors from 'cors';
import { agent } from './agent.js';
import dotenv from 'dotenv';
import helmet from 'helmet'; // Import Helmet

dotenv.config();

const app = express();
const port = process.env.AGENT_PORT || 3001;

// Enable trust proxy if behind a reverse proxy like nginx or load balancer
app.set('trust proxy', true);

// Security: Add Helmet for security headers
app.use(helmet());

// CORS configuration with more control
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:8080'];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true); // Allow requests with no origin
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('AI Agent Server is running');
});

app.post('/generate', async (req, res) => {
  const { prompt, thread_id } = req.body;

  if (!prompt || !thread_id) {
    return res.status(400).json({ error: 'Missing required parameters: prompt and thread_id are required.' });
  }

  try {
    const result = await agent.invoke(
      {
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      { configurable: { thread_id } }
    );

    if (!result?.messages?.length) {
      console.warn('No messages returned from agent.invoke');
      return res.status(500).json({ error: 'No response from AI agent.' });
    }

    const lastMessage = result.messages.at(-1);

    if (!lastMessage?.content) {
      console.warn('Last message has no content.');
      return res.status(500).json({ error: 'AI agent returned an empty response.' });
    }

    res.status(200).json({ response: lastMessage.content });
  } catch (error) {
    console.error('Error in generate endpoint:', error);
    res.status(500).json({ error: 'Failed to process request. See server logs for details.' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const server = app.listen(port, () => {
  console.log(`Agent server is running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});