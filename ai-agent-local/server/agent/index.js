import express from 'express';
import cors from 'cors';
import { agent } from './agent.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.AGENT_PORT || 3001;

// Enable trust proxy if behind a reverse proxy like nginx or load balancer
app.set('trust proxy', true);

// CORS configuration with more control
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Define your allowed origins here.  Read from environment variables for production.
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:8080']; // Example
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
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

    if (!result || !result.messages || result.messages.length === 0) {
      console.warn('No messages returned from agent.invoke');
      return res.status(500).json({ error: 'No response from AI agent.' });
    }

    const lastMessage = result.messages.at(-1);

    if (!lastMessage || !lastMessage.content) {
      console.warn('Last message has no content.');
      return res.status(500).json({ error: 'AI agent returned an empty response.' });
    }

    res.status(200).json({ response: lastMessage.content }); // Explicitly name the returned content
  } catch (error) {
    console.error('Error in generate endpoint:', error);
    res.status(500).json({ error: 'Failed to process request. See server logs for details.' }); // More informative error message
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