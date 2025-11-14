import { useState } from "react"
import { useLoaderData } from "react-router-dom"
import UserCard from "../components/UserCard"


const BASE_URL = import.meta.env.VITE_API_BASE_URL;



export async function all_user_loader() {
  const res = await fetch(`${BASE_URL}/api/users/all`);

  const contentType = res.headers.get("content-type") || "";

  const text = await res.text();

  if (!contentType.includes("application/json")) {
    console.error("Unexpected response from API:", text);
    throw new Error("Server returned non-JSON response");
  }

  return JSON.parse(text);
}






export default function Network(){
    const data = useLoaderData(); 
    const users = data.users ?? [];


    return (
        <>
        <div className="pt-20 w-screen flex justify-center">
            <div className=" max-w-250 gap-5 grid grid-cols-3">
            {users.map((user) => (
         <div className="" key={user.id} >
            <UserCard id={user.id} name={user.name}  />
         </div>
          
      ))}
        </div>
        </div>
        
        
        </>
        
      
  );
}


