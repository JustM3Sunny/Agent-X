import express from 'express';
import cors from 'cors';
import { VM } from 'vm2';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { isDeepStrictEqual } from 'util'; // Import for safer object comparison

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

const MAX_CODE_LENGTH = 5000; // Reduced max code length for security
const VM_TIMEOUT = 3000; // Reduced timeout for faster response and resource management

app.post('/execute', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Code must be a string' });
  }

  const trimmedCode = code.trim();
  if (!trimmedCode) {
    return res.status(400).json({ error: 'Empty code provided' });
  }

  if (trimmedCode.length > MAX_CODE_LENGTH) {
    return res.status(400).json({ error: 'Code too long' });
  }

  let result = '';
  let error = '';

  try {
    const vm = new VM({
      timeout: VM_TIMEOUT,
      sandbox: {
        console: {
          log: (...args) => {
            result += args.map(arg => {
              try {
                if (typeof arg === 'object' && arg !== null) {
                  return JSON.stringify(arg, null, 2); // Pretty print JSON
                } else {
                  return String(arg);
                }
              } catch (e) {
                return '[Unserializable Object]';
              }
            }).join(' ') + '\n';
          },
          error: (...args) => {
            error += args.map(arg => {
              try {
                if (typeof arg === 'object' && arg !== null) {
                  return JSON.stringify(arg, null, 2); // Pretty print JSON
                } else {
                  return String(arg);
                }
              } catch (e) {
                return '[Unserializable Object]';
              }
            }).join(' ') + '\n';
          }
        },
        // Prevent access to potentially dangerous globals
        // process: undefined,
        // require: undefined,
        // global: undefined,
        // root: undefined,
        // constructor: undefined,
      },
      eval: false,
      wasm: false,
    });

    const wrappedCode = `
      try {
        ${trimmedCode}
      } catch (err) {
        console.error(err.message);
      }
    `;

    let output;
    try {
      output = vm.run(wrappedCode);

      if (output !== undefined && typeof output !== 'function') {
        try {
          if (typeof output === 'object' && output !== null) {
            result += JSON.stringify(output, null, 2); // Pretty print JSON
          } else {
            result += String(output);
          }
        } catch (e) {
          result += '[Unserializable Output]';
        }
      }
    } catch (vmError) {
      console.error('VM Error:', vmError);
      error += vmError.message || 'VM Execution Error';
    }

    res.json({
      result: result.trim(),
      error: error.trim()
    });
  } catch (err) {
    console.error('Error executing code:', err);
    res.status(500).json({
      result: result.trim(),
      error: (err.message || 'Error executing code').trim()
    });
  }
});

app.listen(port, () => {
  console.log(`Executor server is running on port ${port}`);
});