"use client";

interface Props {
  insights: string;
  loading: boolean;
}

export default function InsightsPanel({ insights, loading }: Props) {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-2 text-gray-200">
        Insights{loading && <span className="ml-2 text-xs text-blue-400 animate-pulse">updating...</span>}
      </h2>
      <div className="flex-1 overflow-y-auto bg-gray-800 rounded-lg p-4 text-sm text-gray-100 whitespace-pre-wrap">
        {insights || (
          <span className="text-gray-500 italic">
            Insights will appear after some transcript has accumulated...
          </span>
        )}
      </div>
    </div>
  );
}
