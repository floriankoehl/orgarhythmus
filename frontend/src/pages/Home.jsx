import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Input from '@mui/material/Input';
import FilledInput from '@mui/material/FilledInput';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import InputAdornment from '@mui/material/InputAdornment';
import FormHelperText from '@mui/material/FormHelperText';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useState, useEffect, useRef } from 'react';
import Button from '@mui/material/Button';

import { BASE_URL } from "../config/api";// Pfad anpassen falls nötig
import { useLoaderData } from 'react-router-dom';


export async function comment_loader() {
  const res = await fetch(`${BASE_URL}/api/comments/all_comments/`);

  if (!res.ok) {
    throw new Error("Failed to fetch comments");
  }

  const data = await res.json();  
  return data.comments; // return the list itself
  return {}
}















export default function InputAdornments() {
  const comments = useLoaderData();
  const [comment, setComment] = useState("");
  const [author, setAuthor] = useState("");

  async function write_comment(){
    const data = {comment, author}

    
    
    const res = await fetch(`${BASE_URL}/api/comments/write/`, {
      method: "POST", 
      headers: {
        "Content-Type": "application/json",
      }, 
      body: JSON.stringify(data)
    });

    if (!res.ok){
      console.log(res)
      return
    }

    const result = await res.json();
    console.log(res)

    window.location.reload();

  }
  

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]); // run whenever new comments come in



//

  return (

    <div className='w-screen h-200 flex justify-center items-center'>
      <div className='w-100 h-150 bg-black/5 rounded-xl '>
        <div className='h-6/8 bg-white overflow-y-scroll'>
          {comments.map(c => (
  <div key={c.id} className="px-4 py-2">
    <div className="flex items-start gap-2">
      
      {/* Avatar (initial letter) */}
      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center font-bold text-gray-700">
        {c.author ? c.author[0].toUpperCase() : "?"}
      </div>

      {/* Message bubble */}
      <div className="bg-gray-200 px-4 py-2 rounded-2xl max-w-[70%]">
        <div className="text-sm font-semibold">{c.author}</div>
        <div className="text-gray-800">{c.text}</div>
      </div>
            <div ref={bottomRef} />
    </div>
  </div>
))}

        </div>
        <div className='h-2/8 flex flex-col gap-3 p-2 justify-center items-end'>
          <div className='flex place-items-stretch gap-6'>
            <h1 className='font-bold'>Author: </h1>
            <TextField onChange={(e)=>{setAuthor(e.target.value)}} className="bg-white" id="outlined-basic" label="Outlined" variant="outlined" />
          </div>

          <div className='flex items-center gap-3'>
            <h1 className='font-bold'>Message: </h1>
            <TextField onChange={(e)=>{setComment(e.target.value)}} className="bg-white overflow-y-scroll" id="outlined-basic" label="Outlined" variant="outlined" />

          </div>


        </div>
        <div className='flex justify-end mt-2'>
         
          <Button onClick={()=> {write_comment()}} className="" variant="contained">Send</Button>
        </div>
        
      </div>
      
    </div>

  );
}
