import express from 'express';
import cors from 'cors';
import { VM } from 'vm2';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const port = process.env.EXECUTOR_PORT || 3002;

// Rate limiting middleware to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(limiter);
app.use(express.json({ limit: '100kb' })); // Limit request body size
app.use(cors({ origin: '*' }));

app.get('/', (req, res) => {
  res.send('Code Executor Server is running');
});

app.post('/execute', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Code must be a string' });
  }

  let result = '';
  let error = '';

  try {
    // Validate code structure
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      return res.status(400).json({ error: 'Empty code provided' });
    }

    // Prevent infinite loops and resource exhaustion
    if (trimmedCode.length > 10000) {
      return res.status(400).json({ error: 'Code too long' });
    }

    // Create a sandbox with VM2 for secure code execution
    const vm = new VM({
      timeout: 5000, // 5 seconds timeout
      sandbox: {
        console: {
          log: (...args) => {
            result += args.map(arg => {
              try {
                return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
              } catch (e) {
                return '[Unserializable Object]';
              }
            }).join(' ') + '\n';
          },
          error: (...args) => {
            error += args.map(arg => {
              try {
                return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
              } catch (e) {
                return '[Unserializable Object]';
              }
            }).join(' ') + '\n';
          }
        },
        // Remove fetch to prevent network access
        // fetch: global.fetch,
      },
      eval: false,
      wasm: false,
    });

    // Wrap the code in a try-catch block to catch syntax errors
    const wrappedCode = `
      try {
        ${trimmedCode}
      } catch (err) {
        console.error(err.message);
      }
    `;

    // Run the code in the sandbox
    let output;
    try {
      output = vm.run(wrappedCode);
    } catch (vmError) {
      console.error('VM Error:', vmError);
      error += vmError.message || 'VM Execution Error';
    }

    if (output !== undefined && typeof output !== 'function') {
      try {
        result += String(output);
      } catch (e) {
        result += '[Unserializable Output]';
      }
    }

    res.json({
      result: result.trim(),
      error: error.trim()
    });
  } catch (err) {
    console.error('Error executing code:', err);
    res.status(500).json({ // Changed to 500 for server errors
      result: result.trim(),
      error: (err.message || 'Error executing code').trim()
    });
  }
});

app.listen(port, () => {
  console.log(`Executor server is running on port ${port}`);
});