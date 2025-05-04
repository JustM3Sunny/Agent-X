import express from 'express';
import cors from 'cors';
import { VM } from 'vm2';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { xss } from 'xss';

dotenv.config();

const app = express();
const port = process.env.EXECUTOR_PORT || 3002;

// Rate limiting middleware to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(express.json({ limit: '100kb' }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' })); // Use environment variable for CORS origin
app.use(helmet());

app.get('/', (req, res) => {
  res.send('Code Executor Server is running');
});

const MAX_CODE_LENGTH = 2000;
const VM_TIMEOUT = 2000;

// Centralized error handling function
const handleExecutionError = (res, statusCode, message, error = '') => {
  console.error(message, error);
  res.status(statusCode).json({ error: message, details: error }); // More informative error response
};

// Custom serializer to handle circular references and unserializable objects
const customSerializer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular Reference]";
      }
      seen.add(value);
    }
    return value;
  };
};

app.post('/execute', async (req, res) => {
  try {
    let { code } = req.body;

    if (!code) {
      return handleExecutionError(res, 400, 'No code provided');
    }

    if (typeof code !== 'string') {
      return handleExecutionError(res, 400, 'Code must be a string');
    }

    code = xss(code); // Sanitize the input code

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      return handleExecutionError(res, 400, 'Empty code provided');
    }

    if (trimmedCode.length > MAX_CODE_LENGTH) {
      return handleExecutionError(res, 400, 'Code too long');
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
                    return JSON.stringify(arg, customSerializer(), 2); // Pretty print JSON with custom serializer
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
                    return JSON.stringify(arg, customSerializer(), 2); // Pretty print JSON with custom serializer
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
          Buffer: undefined,
          __proto__: null, // More secure than undefined
          Math: Math,
          Date: undefined, // Remove Date object
          Function: undefined, // Remove Function constructor
          eval: undefined, // Remove eval function
          require: undefined, // Remove require function
          process: undefined,
          // Add a safe timer
          setTimeout: undefined,
          setInterval: undefined,
          clearTimeout: undefined,
          clearInterval: undefined,
          // Add a safe way to get current time
          currentTime: () => Date.now()
        },
        eval: false,
        wasm: false,
      });

      const wrappedCode = `
        try {
          ${trimmedCode}
        } catch (err) {
          console.error(err.message);
          error = err.message; // Capture error message for response
        }
      `;

      let output;
      try {
        output = vm.run(wrappedCode);

        if (output !== undefined && typeof output !== 'function') {
          try {
            if (typeof output === 'object' && output !== null) {
              result += JSON.stringify(output, customSerializer(), 2); // Pretty print JSON with custom serializer
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
    } catch (vmSetupError) {
      return handleExecutionError(res, 500, 'VM Setup Error:', vmSetupError.message);
    }
  } catch (err) {
    return handleExecutionError(res, 500, 'Error executing code:', err.message);
  }
});

app.listen(port, () => {
  console.log(`Executor server is running on port ${port}`);
});