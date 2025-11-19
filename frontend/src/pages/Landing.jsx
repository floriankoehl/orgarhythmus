import bg from "../assets/bg_1.jpg";
import Avatar from '@mui/material/Avatar';
import profilePic from "../assets/profile_pic.png";
import { useState } from "react";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import TouchAppIcon from '@mui/icons-material/TouchApp';


export default function Landing() {
    const [sizeIcon, setSizeIcon] = useState(90);
    const [clicked, setClicked] = useState(false);
    const [click_socials, setClick_Socials] = useState(false);

    function changeSizeIcon(newSize) {
        setSizeIcon(newSize);
    }

    return (
        <>
            
            <div
                className="relative h-screen w-full"
                style={{
                    backgroundImage: `url(${bg})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                }}
            >
                <div className="absolute inset-0 bg-black/30" />

                <div className="relative z-10 flex flex-col gap-10 items-center justify-center h-full">
                    <div className="min-h-1/4 flex flex-col items-center justify-end flex-col gap-10">
                    
                        <div 
                        onClick={()=>{if (!clicked) {setClicked(true)} else {setClicked(false)}}}
                        className={`relative
                                    bg-black/15
                                    
                                    backdrop-blur-lg 
                                    border border-white/25 
                                    rounded-2xl 
                                    

                                    text-center 
                                    text-white 
                                    shadow-2xl
                                    flex 
                                    items-center
                                    justify-center
                                    gap-7
                                    py-4
                                    px-8
                                    shadow-[0_0_120px_rgba(255,255,255,0.1)]
                                    text-[35px]

                                    transition-all
                                    
                                    hover:shadow-[0_0_120px_rgba(255,255,255,0.2)]
                                    hover:bg-blue-10/20

                                    ${clicked ? "-translate-y-10" : ""}
                                    `}
                                    onMouseOver={()=>{changeSizeIcon(92)}}
                                    onMouseLeave={()=>{changeSizeIcon(90)}}
                                    >
                                        <Avatar className="relative  p-1" sx={{
                        width: `${sizeIcon}px`,
                        height: `${sizeIcon}px`,
                        bgcolor: 'white',
                    }} alt="Florian Köhl" src={profilePic} />
                        <h1  className=" font-semibold">Florian Köhl</h1>
                        {!clicked && <TouchAppIcon className="animate-bounce text-white opacity-80 !h-[40px] !w-[40px] absolute bottom-0 right-5 translate-y-8/10"/>
}
                    </div>
                    
                    </div>


                    <div
                        className={`
                                    bg-black/15
                                    backdrop-blur-lg 
                                    border border-white/25 
                                    rounded-2xl 
                                    p-8  
                                    text-center 
                                    text-white 
                                    shadow-2xl
                                    w-8/10

                                    transition-all duration-300 ease-out
                                    ${clicked ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}
                                `}
                    >
                        <h1 className="text-4xl font-semibold mb-4">The Roadmap of my Life</h1>
                        <p className="text-lg">
                            Projects, ideas and experiments that shaped my path so far.
                        </p>

                        

                    </div>


                    <div
                        className={`
                                    absolute
                                    bottom-10
                                    bg-black/15
                                    backdrop-blur-lg
                                    border border-white/25
                                    rounded-2xl
                                    p-6
                                    text-center
                                    text-white
                                    shadow-2xl
                                    w-15
                                    h-15
                                    flex items-center justify-center

                                    transition-all duration-300 ease-out
                                    ${clicked ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}
                                `}
                    >
                        <KeyboardArrowDownIcon className="animate-bounce text-white opacity-80 !h-[40px] !w-[40px] translate-y-[5px]"  cx/>
                    </div>





                </div>
            </div>

        </>
    );
};






