import { useLoaderData } from "react-router-dom"
import { BASE_URL } from "../config/api";

// Profile.jsx
export async function profile_loader() {
    const res = await fetch(`${BASE_URL}/api/auth/me/`, {
        credentials: "include"
    });
    
    if (!res.ok) {
        // Nicht eingeloggt → Redirect zum Login
        throw new Response("Not authenticated", { 
            status: 401,
            statusText: "Please login first"
        });
    }
    
    return res.json();
}
//
export default function Profile() {
    const data = useLoaderData();
    
    return (
        <div className="w-screen flex justify-center items-center">
            <div className="w-200 h-100 flex flex-col gap-5 justify-center items-center bg-black/5 rounded-xl">
                <h1 className="text-6xl font-bold">{data.username}</h1>
                <p>User ID: {data.id}</p>
                <p>Email: {data.email || "Keine Email"}</p>
                <p>Hi</p>
            </div>
        </div>
    );
}