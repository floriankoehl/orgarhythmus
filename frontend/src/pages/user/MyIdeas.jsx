import { useEffect, useState } from "react";
import { authFetch } from "../../auth";

export default function MyIdeas() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/user/ideas/")
      .then((res) => res.json())
      .then((data) => {
        setIdeas(data.ideas || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch user ideas:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">My Ideas</h1>
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : ideas.length === 0 ? (
        <p className="text-gray-500 italic">No ideas yet.</p>
      ) : (
        <ul className="space-y-3">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm"
            >
              {idea.headline && (
                <p className="text-xs font-semibold text-gray-500 mb-0.5">{idea.headline}</p>
              )}
              <p className="text-sm text-gray-800">{idea.title}</p>
              <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                {idea.category_name && <span>📂 {idea.category_name}</span>}
                {idea.project_name && <span>🗂 {idea.project_name}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
