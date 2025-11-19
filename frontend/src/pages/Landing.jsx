import bg from "../assets/bg_1.jpg";
import Avatar from '@mui/material/Avatar';
import profilePic from "../assets/profile_pic.png";
import Roadmap from "../assets/roadmap.jpg";
import path_bg from "../assets/path.jpg";
import Github from "../components/Github.jsx";
import GithubStats from "../components/GithubStats";
import GithubHeatmapIcon from "../components/GithubHeatmapIcon";




import { useState, useRef, useEffect } from "react";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import TouchAppIcon from '@mui/icons-material/TouchApp';


export default function Landing() {
    const [sizeIcon, setSizeIcon] = useState(90);
    const [clicked, setClicked] = useState(false);
    const [roadmapflag, setRoadmapflag] = useState(false);
    const roadmapRef = useRef(false);

    const scrollToRoadmap = () => {
        roadmapRef.current?.scrollIntoView({
            behavior: "smooth",   // smooth animation
            block: "start",       // align to top of viewport
        });
    };


    function changeSizeIcon(newSize) {
        setSizeIcon(newSize);
    }

    useEffect(() => {
        if (roadmapflag) {
            roadmapRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    }, [roadmapflag]);

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
                            onClick={() => { if (!clicked) { setClicked(true) } else { setClicked(false) } }}
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
                            onMouseOver={() => { changeSizeIcon(92) }}
                            onMouseLeave={() => { changeSizeIcon(90) }}
                        >
                            <Avatar className="relative  p-1" sx={{
                                width: `${sizeIcon}px`,
                                height: `${sizeIcon}px`,
                                bgcolor: 'white',
                            }} alt="Florian Köhl" src={profilePic} />
                            <h1 className=" font-semibold">Florian Köhl</h1>
                            {!clicked && <TouchAppIcon
                                className="animate-bounce text-white opacity-80 !h-[40px] !w-[40px] absolute bottom-0 right-5 translate-y-8/10"
                            />}
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
                        onClick={() => {
                            if (!roadmapflag) {
                                setRoadmapflag(true);
                            }
                            scrollToRoadmap();
                        }}
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


                                    hover:bg-white/20    
                                    transition-all duration-300 ease-out
                                    ${clicked ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}
                                `}
                    >
                        <KeyboardArrowDownIcon className="animate-bounce text-white opacity-80 !h-[40px] !w-[40px] translate-y-[5px]" cx />
                    </div>





                </div>
                <div className={`relative 
                                h-1
                                bg-white
                                ${roadmapflag ? "opacity-100 scale-100 " : "opacity-0 scale-95 pointer-events-none hidden"}
                                `}></div>
                <div
                    ref={roadmapRef}
                    className={`relative 
                                min-h-screen
                                w-full 
                                ${roadmapflag ? "opacity-100 scale-100 " : "opacity-0 scale-95 pointer-events-none hidden"}
                                `}


                    style={{
                        backgroundImage: `url(${path_bg})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}

                >

                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-10">
                        <div className="
                    
                               
                                    inset-0 
                                    bg-gradient-to-b
                                    from-white/5 
                                    via-white/20 
                                    to-white/10
                                    backdrop-blur-lg

                                    shadow-[0_0_150px_rgba(255,255,255,0.15)]
                                    border border-white/20
                                    rounded-2xl
                                    p-6
                                    text-center
                                    text-white
                                    shadow-2xl
                                    w-full
                                    max-w-[1200px]
                                    
                                    flex items-center justify-center
                    ">


                            <div className=" w-full max-w-5xl mx-auto">
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                   

                                    {/* Bottom row left */}
                                    <div className="flex justify-center items-center">
                                        <Github />
                                    </div>

                                    {/* Bottom row right */}
                                    <div className="flex justify-center items-center">
                                        <GithubStats />
                                    </div>
                                     {/* Heatmap */}
                                    <div className=" hidden md:block flex items-center justify-center md:col-span-2 ">
                                        <GithubHeatmapIcon username="floriankoehl" variant="large" />
                                    </div>
                                </div>
                            </div>


                        </div>

                    </div>

                </div>

            </div>
        </>
    );
};






