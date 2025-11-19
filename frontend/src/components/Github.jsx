// src/components/Github.jsx
import { useEffect, useState } from "react";

export default function Github() {
  const [repo, setRepo] = useState(null);
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [repoRes, contentsRes] = await Promise.all([
          fetch("https://api.github.com/repos/floriankoehl/Network"),
          fetch("https://api.github.com/repos/floriankoehl/Network/contents"),
        ]);

        if (!repoRes.ok) {
          throw new Error(`Repo request failed: ${repoRes.status}`);
        }
        if (!contentsRes.ok) {
          throw new Error(`Contents request failed: ${contentsRes.status}`);
        }

        const repoData = await repoRes.json();
        const contentsData = await contentsRes.json();

        setRepo(repoData);
        setContents(contentsData);
      } catch (e) {
        console.error(e);
        setError(e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div className="text-white">Loading GitHub data…</div>;
  }

  if (error || !repo) {
    return (
      <div className="text-red-300 text-sm">
        Couldn’t load GitHub repo right now.
      </div>
    );
  }

  return (
    <div className="bg-black/40 border border-white/20 rounded-2xl w-full h-full p-6 text-white max-w-lg">
      <h2 className="text-2xl font-semibold mb-2">{repo.name}</h2>
      <p className="text-sm text-white/70 mb-4">{repo.description}</p>

      <div className="flex gap-4 text-sm text-white/80 mb-4">
        <span>⭐ {repo.stargazers_count}</span>
        <span>🍴 {repo.forks_count}</span>
        <span>⚙ {repo.language}</span>
      </div>

      {/* Simple file list */}
      <div className="mb-4 max-h-48 overflow-y-auto text-sm text-white/80 bg-white/5 rounded-xl p-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-white/50">
          Files
        </p>
        <ul className="space-y-1">
          {contents.map((item) => (
            <li key={item.path} className="flex items-center gap-2">
              <span>{item.type === "dir" ? "📁" : "📄"}</span>
              <a
                href={item.html_url}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {item.name}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <a
        href={repo.html_url}
        target="_blank"
        rel="noreferrer"
        className="inline-block mt-2 text-blue-300 hover:text-blue-200 underline"
      >
        View on GitHub
      </a>
    </div>
  );
}
