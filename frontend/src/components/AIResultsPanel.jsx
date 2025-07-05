import React, { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { X } from "lucide-react";
import { useEffect } from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}

const AIResultsPanel = () => {
  const { 
    aiResults, 
    clearAIResults, 
    setText,
    selectedModel,
    setSelectedModel,
    availableModels,
    fetchAvailableModels
  } = useChatStore();

  const [loadingModels, setLoadingModels] = useState(true);
  const [modelError, setModelError] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoadingModels(true);
        await fetchAvailableModels();
      } catch (error) {
        setModelError('Failed to load models');
        console.error('Model loading error:', error);
      } finally {
        setLoadingModels(false);
      }
    };
    loadModels();
  }, []);

  if (modelError) {
    return (
      <div className="bg-base-200 rounded-lg p-4 mb-4">
        <div className="text-error">{modelError}</div>
      </div>
    );
  }

  if (!aiResults) return null;

  return (
    <div className="px-4 py-3">
      <div className="bg-base-200 rounded-lg p-4 relative">
        <button
          onClick={clearAIResults}
          className="absolute top-2 right-2 text-base-content/70 hover:text-base-content"
        >
          <X size={18} />
        </button>

        {aiResults?.type === "sentiment" && (
          <div className="text-sm">
            <span className="font-semibold">Sentiment:</span> 
            {aiResults.label === 'positive' && '😊 '}
            {aiResults.label === 'negative' && '😞 '}
            {aiResults.label === 'neutral' && '😐 '}
            {aiResults.label}
            <span className="ml-2 text-base-content/70">
              ({aiResults.label === 'negative' ? '-' : ''}{(aiResults.confidence * 100).toFixed(1)}% confidence)
            </span>
          </div>
        )}

        {aiResults?.type === "smart-replies" && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">Suggested Replies</h3>
              {availableModels.length > 0 && (
                <select 
                  className="select select-bordered select-sm"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {availableModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {aiResults?.replies?.map((reply) => (
                <button
                  key={reply}
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    setText(reply);
                    clearAIResults();
                  }}
                >
                  {reply.replace(/^\d+\.\s*/, '')}
                </button>
              ))}
            </div>
          </div>
        )}

        {aiResults?.type === "summary" && (
          <div>
            <h3 className="font-semibold text-sm mb-2">Conversation Summary</h3>
            <div className="text-sm whitespace-pre-line">
              {aiResults.content || aiResults.summary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIResultsPanel;
export { ErrorBoundary };
