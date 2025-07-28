import React, { useState } from 'react';
import { ModelProviderId } from '../types';
import { MODELS_CONFIG } from '../config/models';
import { CheckCircleIcon } from './Icons';

interface ModelSelectorProps {
    onModelSelect: (providerId: ModelProviderId, modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelSelect }) => {
    const [selectedProvider, setSelectedProvider] = useState<ModelProviderId | null>(null);

    const handleSelectModel = (providerId: ModelProviderId, modelId: string) => {
        onModelSelect(providerId, modelId);
    };

    return (
        <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-cloud tracking-tight">
                Choose Your AI Engine
            </h2>
            <p className="mt-4 max-w-3xl text-lg text-gray-600 dark:text-cloud/80">
                Select the provider and model you want to use for contract analysis.
            </p>

            <div className="mt-12 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                {MODELS_CONFIG.map((provider) => (
                    <div 
                        key={provider.id} 
                        className={`bg-white dark:bg-midnight-light border rounded-lg shadow-lg p-6 transition-all duration-300 ${selectedProvider === provider.id ? 'border-teal dark:border-lilac ring-2 ring-teal dark:ring-lilac' : 'border-gray-200 dark:border-midnight-lighter'}`}
                    >
                        <div 
                            className="flex items-center justify-center gap-4 cursor-pointer"
                            onClick={() => setSelectedProvider(p => p === provider.id ? null : provider.id)}
                        >
                            <provider.Icon className="w-10 h-10 text-teal dark:text-lilac" />
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-cloud">{provider.name}</h3>
                        </div>

                        {selectedProvider === provider.id && (
                            <div className="mt-6 space-y-4 animate-fade-in">
                                {provider.models.map(model => (
                                    <button
                                        key={model.id}
                                        onClick={() => handleSelectModel(provider.id, model.id)}
                                        className="w-full text-left p-4 border border-gray-200 dark:border-midnight-lighter rounded-lg hover:bg-gray-50 dark:hover:bg-midnight-lighter/50 hover:border-teal dark:hover:border-lilac focus:outline-none focus:ring-2 focus:ring-teal dark:focus:ring-lilac transition-all"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-cloud">{model.name}</p>
                                                <p className="text-sm text-gray-600 dark:text-cloud/70 mt-1">{model.description}</p>
                                            </div>
                                            <CheckCircleIcon className="w-6 h-6 text-teal dark:text-lilac opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
             <style>{`
                .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
             `}</style>
        </div>
    );
};
