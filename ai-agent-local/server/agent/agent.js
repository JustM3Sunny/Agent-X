import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatGroq } from '@langchain/groq';
import { MemorySaver } from '@langchain/langgraph';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const jsExecutor = tool(
  async ({ code }) => {
    const executorUrl = process.env.EXECUTOR_URL || 'http://localhost:3002';
    const response = await fetch(`${executorUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    return await response.json();
  },
  {
    name: 'run_javascript_code_tool',
    description: `
      Run general purpose javascript code. 
      This can be used to access Internet or do any computation that you need. 
      The output will be composed of the stdout and stderr. 
      The code should be written in a way that it can be executed with javascript eval in node environment.
   `,
    schema: z.object({
      code: z.string().describe('The code to run'),
    }),
  }
);

const weatherTool = tool(
  async ({ query }) => {
    console.log('weather query:', query);
    
    // Simple weather response for demo purposes
    return 'The weather in Tokyo is sunny';
  },
  {
    name: 'weather',
    description: 'Get the weather in a given location',
    schema: z.object({
      query: z.string().describe('The query to use in search'),
    }),
  }
);

// Initialize the AI model with Groq
const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama3-70b-8192',
});

const checkpointSaver = new MemorySaver();

export const agent = createReactAgent({
  llm: model,
  tools: [weatherTool, jsExecutor],
  checkpointSaver,
}); 