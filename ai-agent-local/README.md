# AI Agent Application

An AI agent application that can execute JavaScript code using LangGraph.js, running locally without Genezio.

## Features

- Execute JavaScript code securely with VM2
- Built with Claude 3 Sonnet
- Modern React frontend with TypeScript
- Local development setup

## Project Structure

```
ai-agent-local/
├── client/              # React frontend
├── server/              # Node.js backend
│   ├── agent/           # AI agent with LangGraph.js
│   └── executor/        # JavaScript code executor
```

## Setup

### Prerequisites

- Node.js (v18 or later)
- NPM or Yarn

### Installation

1. Clone this repository

2. Install server dependencies:

```bash
# Install agent server dependencies
cd ai-agent-local/server/agent
npm install

# Install executor server dependencies
cd ../executor
npm install
```

3. Install client dependencies:
```bash
# Install client dependencies
cd ../../client
npm install
```

4. Set up environment variables:

```bash
# In server folder
cd ../server
cp .env.example .env
```

Edit the `.env` file to add your Anthropic API key.

## Running the Application

1. Start the executor server:

```bash
cd ai-agent-local/server/executor
npm run dev
```

2. Start the agent server:

```bash
cd ../agent
npm run dev
```

3. Start the client:

```bash
cd ../../client
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## How it Works

- The frontend allows users to send messages to the AI agent
- The agent processes the message using LangGraph.js and Claude 3 Sonnet
- The agent can execute JavaScript code using the code executor service
- The executor service uses VM2 to run the code securely

## License

MIT 