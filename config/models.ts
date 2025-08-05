import React from 'react';
import { Provider } from '../types';
import { SirionLogo } from '../components/SirionLogo';

// NOTE FOR DEVELOPERS:
// The 'gpt-4.1-mini' model is the correct production model. It replaced 'gpt-4o-mini'
// following its official launch on April 14, 2025.
// Previous analysis may have failed due to using the older identifier or
// testing against accounts without access during the initial rollout.
// This is the confirmed model to use moving forward.
export const MODELS_CONFIG: Provider[] = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        apiKeyName: 'Gemini API Key',
        Icon: ({ className }) => React.createElement(SirionLogo, { className }),
        models: [
            {
                id: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                description: 'A fast and versatile multimodal model, ideal for general-purpose contract analysis.'
            }
        ]
    },
    {
        id: 'openai',
        name: 'OpenAI',
        apiKeyName: 'OpenAI API Key',
        Icon: ({ className }) => React.createElement('svg', {
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 448 512",
                className: className,
                fill: "currentColor"
            },
            React.createElement('path', {
                d: "M429.3 128.4L252.8 24.6c-4-2.3-8.8-2.3-12.8 0L63.7 128.4c-4 2.3-6.4 6.6-6.4 11.2v192c0 4.6 2.4 8.9 6.4 11.2l176.5 103.8c4 2.3 8.8 2.3 12.8 0L429.3 342.8c-4-2.3-6.4-6.6-6.4-11.2v-192c0-4.6-2.4-8.9-6.4-11.2zM224 430.4L64 334.2V158.8l160 94.2v177.4zm0-193.2L64 143.1l160-94.2 160 94.2-160 94.1zM240 334.2V240l160-94.2v175.4l-160 94.2z"
            })
        ),
        models: [
            {
                id: 'gpt-4.1-mini',
                name: 'GPT-4.1 mini',
                description: 'A smaller, faster, and more affordable model from OpenAI, suitable for various tasks.'
            }
        ]
    },
    {
        id: 'llama',
        name: 'Llama',
        apiKeyName: 'Groq API Key / AWS Credentials',
        Icon: ({ className }) => React.createElement('svg', {
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                className: className,
                fill: "currentColor"
            },
            React.createElement('path', {
                d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
            })
        ),
        models: [
            {
                id: 'llama-3.3-70b-versatile',
                name: 'Llama 3.3 70B',
                description: 'A powerful and versatile large language model, ideal for complex contract analysis tasks.'
            },
            {
                id: 'llama-3.3-70b-bedrock',
                name: 'Llama 3.3 70B (Bedrock - use this)',
                description: 'Llama 3.3 70B model hosted on AWS Bedrock, optimized for contract analysis with robust error handling.'
            },
            {
                id: 'llama-3.3-70b-watsonx',
                name: 'Llama 3.3 70B (WatsonX)',
                description: 'Llama 3.3 70B model hosted on IBM WatsonX, optimized for contract analysis with enterprise-grade reliability.'
            }
        ]
    }
];