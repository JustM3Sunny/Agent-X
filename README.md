# Agent-X

An AI Agent with code execution capabilities built using React, TypeScript, and Node.js.

## Features

- AI-powered code execution
- Secure code sandboxing
- Real-time code execution results
- Modern React-based UI

## Project Structure

```
agent-x/
├── ai-agent-local/
│   ├── client/          # React frontend
│   └── server/          # Node.js backend
│       └── executor/    # Code execution service
```

## Getting Started

1. Install dependencies:
```bash
npm run install-all
```

2. Start the development servers:
```bash
npm start
```

3. Open your browser and navigate to `http://localhost:5173`

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
VITE_GROQ_API_KEY=your_groq_api_key
VITE_EXECUTOR_URL=http://localhost:3002/execute
```

## License

MIT 