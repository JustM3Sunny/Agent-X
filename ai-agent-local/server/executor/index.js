import express from 'express';
import cors from 'cors';
import { VM } from 'vm2';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.EXECUTOR_PORT || 3002;

app.use(express.json());
app.use(cors({ origin: '*' }));

app.get('/', (req, res) => {
  res.send('Code Executor Server is running');
});

app.post('/execute', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  let result = '';
  let error = '';

  try {
    // Validate code structure
    if (!code.trim()) {
      return res.status(400).json({ error: 'Empty code provided' });
    }

    // Create a sandbox with VM2 for secure code execution
    const vm = new VM({
      timeout: 5000, // 5 seconds timeout
      sandbox: {
        console: {
          log: (...args) => {
            result += args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : arg
            ).join(' ') + '\n';
          },
          error: (...args) => {
            error += args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : arg
            ).join(' ') + '\n';
          }
        },
        fetch: global.fetch,
      },
      eval: false,
      wasm: false,
    });

    // Wrap the code in a try-catch block to catch syntax errors
    const wrappedCode = `
      try {
        ${code}
      } catch (err) {
        console.error(err.message);
      }
    `;

    // Run the code in the sandbox
    const output = vm.run(wrappedCode);
    
    if (output !== undefined && typeof output !== 'function') {
      result += String(output);
    }

    res.json({ 
      result: result.trim(),
      error: error.trim() 
    });
  } catch (err) {
    console.error('Error executing code:', err);
    res.json({ 
      result: result.trim(),
      error: err.message || 'Error executing code'
    });
  }
});

app.listen(port, () => {
  console.log(`Executor server is running on port ${port}`);
}); 