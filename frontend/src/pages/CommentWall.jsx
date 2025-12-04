// CommentWall.jsx
import { useEffect, useState, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { BASE_URL } from "../config/api";
import { NavLink } from "react-router-dom";
// import { useAuth } from "../../auth/AuthContext";

// import { BASE_URL } from "../../config/api";
import { Send } from "lucide-react";

export default function CommentWall() {
  const { user, isAuthenticated, loadingUser, logout } = useAuth();

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const bottomRef = useRef(null);

  // Reusable fetch function (used by initial load + polling)
  async function fetchComments({ silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const res = await fetch(`${BASE_URL}/api/comments/all_comments/`);
      if (!res.ok) {
        throw new Error("Failed to load comments");
      }
      const data = await res.json();

      setComments(data.comments || []);
    } catch (err) {
      console.error(err);
      if (!silent) {
        setError("Couldn't load comments. Please try again.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments]);

  // Initial load + polling every 3 seconds
  useEffect(() => {
    // First load
    fetchComments();

    // Then poll
    const intervalId = setInterval(() => {
      fetchComments({ silent: true });
    }, 3000); // 3 seconds – adjust if you want

    // Cleanup when component unmounts
    return () => clearInterval(intervalId);
  }, []);

  async function handleSend(e) {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!isAuthenticated) {
      setError("You must be logged in to post a comment.");
      return;
    }

    try {
      setSending(true);
      setError(null);

      const accessToken = localStorage.getItem("access_token");

      const res = await fetch(`${BASE_URL}/api/comments/write/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ text: newComment }),
      });

      if (res.status === 401) {
        setError("Session expired. Please log in again.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send comment");
      }

      const data = await res.json();
      const created = data.comment;

      // Optimistically append new comment
      setComments((prev) => [...prev, created]);
      setNewComment("");

      // Optional: also refresh from backend (not strictly needed because of polling)
      // await fetchComments({ silent: true });
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-screen w-screen flex justify-center items-center pt-0 lg:pt-20 pb-10">
<div
  className="
    flex flex-col
    w-full max-w-2xl 
    rounded-none md:rounded-2xl
    border border-slate-700/70 
    bg-slate-900/80 
    shadow-xl backdrop-blur

    pt-25 md:pt-5
    h-[calc(100vh-64px)] md:h-[70vh]   // ⬅️ FULLSCREEN ON MOBILE, 70vh ON DESKTOP
    max-h-screen md:max-h-[600px]   // ⬅️ PREVENT OVERFLOW ON MOBILE

    p-4
  "
>      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-slate-700/60 pb-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-300">
            Comment Wall
          </h2>
          <p className="text-xs text-slate-400">
            Share thoughts, small updates, random ideas…
          </p>
        </div>
        {isAuthenticated && user && (
          <div className="flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-slate-200">
              Logged in as{" "}
              <span className="font-semibold text-cyan-300">
                {user.username}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 space-y-2 overflow-y-auto rounded-xl bg-slate-950/40 p-3">
        {loading && (
          <p className="text-xs text-slate-400">Loading comments…</p>
        )}

        {!loading && comments.length === 0 && (
          <p className="text-xs text-slate-500">
            No comments yet. Be the first one to say something 👀
          </p>
        )}

        {comments.map((c) => {
          const isOwn = isAuthenticated && user && c.author === user.username;
          return (
            <div
              key={c.id}
              className={`flex w-full ${
                isOwn ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                  isOwn
                    ? "bg-cyan-500/90 text-slate-900 rounded-br-sm"
                    : "bg-slate-800/90 text-slate-100 rounded-bl-sm"
                }`}
              >
                <div className="mb-0.5 flex items-center justify-between gap-3">
                  <span
                    className={`text-[10px] font-semibold ${
                      isOwn ? "text-slate-900/80" : "text-cyan-300/90"
                    }`}
                  >
                    {c.author || "Anonymous"}
                  </span>
                  {c.timestamp && (
                    <span className="text-[9px] text-slate-400/80">
                      {new Date(c.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words">{c.text}</p>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 rounded-xl bg-red-900/40 px-3 py-1.5 text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Input area */}
      {!loadingUser && isAuthenticated && (
       <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
         <input
           type="text"
           className="flex-1 rounded-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
           placeholder={
             isAuthenticated
               ? "Write a comment and press Enter…"
               : "Log in to write a comment…"
           }
           value={newComment}
           onChange={(e) => setNewComment(e.target.value)}
           disabled={!isAuthenticated || sending}
         />
         <button
           type="submit"
           disabled={!isAuthenticated || sending || !newComment.trim()}
           className={`flex items-center gap-1 rounded-full px-3 py-2 text-xs font-medium transition-all ${
             !isAuthenticated || sending || !newComment.trim()
              ? "cursor-not-allowed bg-slate-800/70 text-slate-500"
              : "bg-cyan-500/90 text-slate-900 hover:bg-cyan-400 hover:scale-105"
          }`}
       >
          <Send className="h-4 w-4" />
          <span>{sending ? "Sending…" : "Send"}</span>
        </button>
      </form>
      
      )}

      {!loadingUser && !isAuthenticated && (
          <NavLink
                  to="/login"
                  className={({ isActive }) => getLinkClasses(isActive)}
                  onClick={() => setIsOpen(false)}
                ><div className="bg-white w-full h-10 flex justify-center items-center font-bold rounded-xl mt-3">
                <h1>Log in to write messages!</h1>
            </div></NavLink>
            
          )}


      {/* <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          className="flex-1 rounded-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          placeholder={
            isAuthenticated
              ? "Write a comment and press Enter…"
              : "Log in to write a comment…"
          }
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={!isAuthenticated || sending}
        />
        <button
          type="submit"
          disabled={!isAuthenticated || sending || !newComment.trim()}
          className={`flex items-center gap-1 rounded-full px-3 py-2 text-xs font-medium transition-all ${
            !isAuthenticated || sending || !newComment.trim()
              ? "cursor-not-allowed bg-slate-800/70 text-slate-500"
              : "bg-cyan-500/90 text-slate-900 hover:bg-cyan-400 hover:scale-105"
          }`}
        >
          <Send className="h-4 w-4" />
          <span>{sending ? "Sending…" : "Send"}</span>
        </button>
      </form> */}
    </div>
    </div>
  );
}




// // CommentWall.jsx
// import { useEffect, useState, useRef } from "react";
// import { useAuth } from "../auth/AuthContext";
// import { BASE_URL } from "../config/api";
// // import { useAuth } from "../../auth/AuthContext";
// // import { BASE_URL } from "../../config/api";
// import { Send } from "lucide-react";

// export default function CommentWall() {
//   const { user, isAuthenticated, loadingUser, logout } = useAuth();

//   const [comments, setComments] = useState([]);
//   const [newComment, setNewComment] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [sending, setSending] = useState(false);
//   const [error, setError] = useState(null);

//   const bottomRef = useRef(null);

//   // Auto-scroll to bottom when comments change
//   useEffect(() => {
//     if (bottomRef.current) {
//       bottomRef.current.scrollIntoView({ behavior: "smooth" });
//     }
//   }, [comments]);

//   // Load all comments on mount
//   useEffect(() => {
//     async function fetchComments() {
//       try {
//         setLoading(true);
//         setError(null);

//         const res = await fetch(`${BASE_URL}/api/comments/all_comments/`);
//         if (!res.ok) {
//           throw new Error("Failed to load comments");
//         }
//         const data = await res.json();
//         setComments(data.comments || []);
//       } catch (err) {
//         console.error(err);
//         setError("Couldn't load comments. Please try again.");
//       } finally {
//         setLoading(false);
//       }
//     }

//     fetchComments();
//   }, []);

//   async function handleSend(e) {
//     e.preventDefault();
//     if (!newComment.trim()) return;
//     if (!isAuthenticated) {
//       setError("You must be logged in to post a comment.");
//       return;
//     }

//     try {
//       setSending(true);
//       setError(null);

//       const accessToken = localStorage.getItem("access_token");

//       const res = await fetch(`${BASE_URL}/api/comments/write/`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           ...(accessToken
//             ? { Authorization: `Bearer ${accessToken}` }
//             : {}),
//         },
//         body: JSON.stringify({ text: newComment }),
//       });

//       if (res.status === 401) {
//         setError("Session expired. Please log in again.");
//         return;
//       }

//       if (!res.ok) {
//         const data = await res.json().catch(() => ({}));
//         throw new Error(data.error || "Failed to send comment");
//       }

//       const data = await res.json();
//       const created = data.comment;

//       // Optimistically append the new comment
//       setComments((prev) => [...prev, created]);
//       setNewComment("");
//     } catch (err) {
//       console.error(err);
//       setError(err.message || "Something went wrong.");
//     } finally {
//       setSending(false);
//     }
//   }

//   return (
//     <div className="h-screen w-screen flex justify-center items-center pt-20 lg:pt-30 pb-10">
//     <div className="flex h-[90vh] h-full  w-full max-w-2xl flex-col rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-xl backdrop-blur">
//       {/* Header */}
//       <div className="mb-3 flex items-center justify-between border-b border-slate-700/60 pb-2">
//         <div>
//           <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-300">
//             Comment Wall
//           </h2>
//           <p className="text-xs text-slate-400">
//             Share thoughts, small updates, random ideas…
//           </p>
//         </div>
//         {isAuthenticated && user && (
//           <div className="flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1">
//             <span className="h-2 w-2 rounded-full bg-emerald-400" />
//             <span className="text-xs text-slate-200">
//               Logged in as{" "}
//               <span className="font-semibold text-cyan-300">
//                 {user.username}
//               </span>
//             </span>
//           </div>
//         )}
//       </div>

//       {/* Messages area */}
//       <div className="flex-1 space-y-2 overflow-y-auto rounded-xl bg-slate-950/40 p-3">
//         {loading && (
//           <p className="text-xs text-slate-400">Loading comments…</p>
//         )}

//         {!loading && comments.length === 0 && (
//           <p className="text-xs text-slate-500">
//             No comments yet. Be the first one to say something 👀
//           </p>
//         )}

//         {comments.map((c) => {
//           const isOwn = isAuthenticated && user && c.author === user.username;
//           return (
//             <div
//               key={c.id}
//               className={`flex w-full ${
//                 isOwn ? "justify-end" : "justify-start"
//               }`}
//             >
//               <div
//                 className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
//                   isOwn
//                     ? "bg-cyan-500/90 text-slate-900 rounded-br-sm"
//                     : "bg-slate-800/90 text-slate-100 rounded-bl-sm"
//                 }`}
//               >
//                 <div className="mb-0.5 flex items-center justify-between gap-3">
//                   <span
//                     className={`text-[10px] font-semibold ${
//                       isOwn ? "text-slate-900/80" : "text-cyan-300/90"
//                     }`}
//                   >
//                     {c.author || "Anonymous"}
//                   </span>
//                   {c.timestamp && (
//                     <span className="text-[9px] text-black/60">
//                       {new Date(c.timestamp).toLocaleString()}
//                     </span>
//                   )}
//                 </div>
//                 <p className="whitespace-pre-wrap break-words">{c.text}</p>
//               </div>
//             </div>
//           );
//         })}

//         <div ref={bottomRef} />
//       </div>

//       {/* Error message */}
//       {error && (
//         <div className="mt-2 rounded-xl bg-red-900/40 px-3 py-1.5 text-xs text-red-200">
//           {error}
//         </div>
//       )}

//       {/* Input area */}

//       {!loadingUser && isAuthenticated && (
//       <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
//         <input
//           type="text"
//           className="flex-1 rounded-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
//           placeholder={
//             isAuthenticated
//               ? "Write a comment and press Enter…"
//               : "Log in to write a comment…"
//           }
//           value={newComment}
//           onChange={(e) => setNewComment(e.target.value)}
//           disabled={!isAuthenticated || sending}
//         />
//         <button
//           type="submit"
//           disabled={!isAuthenticated || sending || !newComment.trim()}
//           className={`flex items-center gap-1 rounded-full px-3 py-2 text-xs font-medium transition-all ${
//             !isAuthenticated || sending || !newComment.trim()
//               ? "cursor-not-allowed bg-slate-800/70 text-slate-500"
//               : "bg-cyan-500/90 text-slate-900 hover:bg-cyan-400 hover:scale-105"
//           }`}
//         >
//           <Send className="h-4 w-4" />
//           <span>{sending ? "Sending…" : "Send"}</span>
//         </button>
//       </form>
      
//       )}

//       {!loadingUser && !isAuthenticated && (
//             <div className="bg-white w-full h-10 flex justify-center items-center font-bold rounded-xl mt-3">
//                 <h1>Log in to write messages!</h1>
//             </div>
//           )}
//     </div>
//     </div>
//   );
// }
