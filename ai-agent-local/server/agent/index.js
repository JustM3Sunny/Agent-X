import express from 'express';
import cors from 'cors';
import { agent } from './agent.js';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { isArray } from 'lodash-es'; // Import lodash's isArray for better type checking

dotenv.config();

const app = express();
const port = parseInt(process.env.AGENT_PORT || '3001', 10); // Ensure port is a number

// Enable trust proxy if behind a reverse proxy like nginx or load balancer
app.set('trust proxy', true);

// Security: Add Helmet for security headers
app.use(helmet());

// Security: Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting only to the /generate endpoint
app.use('/generate', limiter);

// CORS configuration with more control
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8080')
  .split(',')
  .map((origin) => origin.trim()); // Trim whitespace

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      // Allow requests with no origin (e.g., mobile apps or curl requests) but log it.
      console.log('Request with no origin allowed.');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      const errorMessage = `CORS blocked request from origin: ${origin}`;
      console.warn(errorMessage);
      return callback(new Error(errorMessage)); // Ensure callback is always called
    }
  },
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

// Logging middleware using Morgan
app.use(morgan('combined')); // 'combined' provides standard Apache log output

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
      const errorMessage = 'No messages returned from agent.invoke';
      logError(errorMessage); // Use centralized logging
      return res.status(500).json({ error: 'No response from AI agent.' });
    }

    const lastMessage = result.messages.at(-1);

    if (!lastMessage?.content) {
      const errorMessage = 'Last message has no content.';
      logError(errorMessage); // Use centralized logging
      return res.status(500).json({ error: 'AI agent returned an empty response.' });
    }

    res.status(200).json({ response: lastMessage.content });
  } catch (error) {
    let errorMessage = 'Failed to process request. See server logs for details.';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    if (error.name === 'TimeoutError') {
      statusCode = 504;
      errorMessage = 'AI agent timed out. Please try again later.';
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = `Validation error: ${error.message}`;
    }

    logError(`Error in generate endpoint: ${errorMessage}`, error); // Log specific error message
    res.status(statusCode).json({ error: errorMessage });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logError('Global error handler:', err); // Use centralized logging, log the full error object
  res.status(500).json({ error: 'Something went wrong!' }); // Removed err.message for security
});

// Centralized logging function
function logError(message, error) {
    console.error(message, error);
    // Optionally, send logs to a centralized logging service (e.g., Sentry, Datadog)
}

let server;

async function startServer() {
  try {
    server = app.listen(port, () => {
      console.log(`Agent server is running on port ${port}`);
    });
  } catch (error) {
    logError('Failed to start server:', error);
    process.exit(1); // Exit if the server fails to start
  }
}

startServer();

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down server...');
  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            logError('Error closing server:', err);
            reject(err);
            return;
          }
          console.log('Server closed');
          resolve();
        });
      });
    }
    console.log('Server shutdown complete.');
    process.exit(0);
  } catch (error) {
    logError('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection at:', reason);
  // Optionally, trigger shutdown or other recovery mechanisms here
});

process.on('uncaughtException', (err) => {
  logError('Uncaught Exception:', err);
  process.exit(1); // Exit after logging the error
});