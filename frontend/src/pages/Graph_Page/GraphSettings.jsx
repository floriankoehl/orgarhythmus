import SettingsIcon from '@mui/icons-material/Settings';
import { useState } from 'react';
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';
import FaceIcon from '@mui/icons-material/Face';
import LocationOnIcon from '@mui/icons-material/LocationOn';






function SettingsExpandContainer({ setCollapseFlagParent, changing_default_display_company_parent, onEdgeFilterChange }) {
  const [view, setView] = useState("medium")
  const [type, setType] = useState("all")

  return (
    <>
      <div className='
            
w-full
absolute 
bottom-0 
z-40


flex
flex-col
items-center
justify-center
'>

        <div className='

h-30
w-120
bg-blue-200/20
rounded-t-xl

backdrop-blur-xl 
border border-black/30 



'>
          <div className="grid h-full grid-cols-[40%_60%] relative">
            <button
              onClick={() => { setCollapseFlagParent(false) }}
              /* THE SETTINGS ITSELF */
              type="button"
              className="
    flex items-center justify-center
    absolute
    right-0
    top-0
    h-6 w-6
    rounded-full
    bg-white
    shadow-md
    transition-shadow transition-transform duration-200
    hover:shadow-xl hover:shadow-black/40
    hover:-translate-y-0.5
  "
            >
              <ExpandCircleDownIcon className="!text-[32px]" />
            </button>



            {/* Left column – 60% */}
            <div className="h-full ">
              <div className='h-1/2 !px-3 flex items-center border-b'>
                View of Company
              </div>
              <div className='h-1/2 !px-3 flex items-center'>
                Type of Connection
              </div>




            </div>


            {/* Right column – 40% */}
            <div >
              <div className='h-1/2 !px-3  flex  gap-3 items-center border-b !pr-9'>


                <div
                  onClick={() => {
                    setView("minimal")
                    changing_default_display_company_parent("minimal_company_display")
                  }}
                  className={`
  ${view === "minimal" ? 'bg-black/20' : 'bg-white'}
  flex
  justify-center
  items-center
  text-black
  h-10 
  w-full
  rounded-xl
  hover:bg-black/30
  backdrop-blur-xl 
  border border-black/30 
  cursor-pointer
`}
                >
                  Minimal
                </div>
                <div
                  onClick={() => {
                    setView("medium")
                    changing_default_display_company_parent("default_company_display")
                  }}
                  className={`
  ${view === "medium" ? 'bg-black/20' : 'bg-white'}
  flex
  justify-center
  items-center
  text-black
  h-10 
  w-full
  rounded-xl
  hover:bg-black/30
  backdrop-blur-xl 
  border border-black/30 
  cursor-pointer
`}
                >
                  Medium
                </div>





              </div>
              <div className='h-1/2 !px-3  flex  gap-3 items-center !pr-9'>
                <div
                  onClick={() => {
                    setType("all")
                    onEdgeFilterChange("all")
                  }}
                  className={`
  ${type === "all" ? 'bg-black/20' : 'bg-white'}
  flex
  justify-center
  items-center
  text-black
  h-10 
  w-full
  rounded-xl
  hover:bg-black/30
  backdrop-blur-xl 
  border border-black/30 
  cursor-pointer
`}>
                  ALL
                </div>
                <div
                  onClick={() => {
                    setType("person")
                    onEdgeFilterChange("person")
                  }}
                  className={`
  ${type === "person" ? 'bg-black/20' : 'bg-white'}
  flex
  justify-center
  items-center
  text-black
  h-10 
  w-full
  rounded-xl
  hover:bg-black/30
  backdrop-blur-xl 
  border border-black/30 
  cursor-pointer
`}>
                  <FaceIcon />
                </div>
                <div
                  onClick={() => {
                    setType("location")
                    onEdgeFilterChange("location")
                  }}
                  className={`
  ${type === "location" ? 'bg-black/20' : 'bg-white'}
  flex
  justify-center
  items-center
  text-black
  h-10 
  w-full
  rounded-xl
  hover:bg-black/30
  backdrop-blur-xl 
  border border-black/30 
  cursor-pointer
`}>
                  <LocationOnIcon />
                </div>
              </div>
            </div>
          </div>


        </div>



      </div>


    </>
  )
}












export default function SettingsButton({ open, changing_default_company_display_tape_f, onEdgeFilterChange }) {
  const [openFlag, setOpenFlag] = useState(open)

  // console.log("IN THE OPEN FLAG", openFlag)

  return (
    <>


      {/* THE SETTINGS WARPPER AND CONTAINER */}
      {openFlag ?
        <SettingsExpandContainer
          setCollapseFlagParent={setOpenFlag}
          changing_default_display_company_parent={changing_default_company_display_tape_f}
          onEdgeFilterChange={onEdgeFilterChange}
        />
        : <div
          onClick={() => { setOpenFlag(true) }}
          className="
    h-10 w-30 
    bg-black 
    absolute 
    bottom-0 
    left-1/2 
    -translate-x-1/2
    z-30 
    bg-gradient-to-br from-indigo-400 to-purple-500 
    rounded-t-xl 
    border
    flex
    justify-center
    items-center
    gap-2
    text-white
    hover:from-purple-400 hover:to-blue-500
  "
        >
          Settings
          <SettingsIcon className='!text-white' />
        </div>

      }

    </>
  )
}


























{/* THE SETTINGS ITSELF */ }
<div className='
bg-blue-200/20
w-170
h-30
rounded-t-xl

backdrop-blur-xl 
border border-black/30 
flex
justify-center
items-center
gap-5




                '>
  <button
    onClick={() => { setCollapseFlagParent(false) }}
    /* THE SETTINGS ITSELF */
    type="button"
    className="
    flex items-center justify-center
    absolute
    right-0
    top-0
    h-6 w-6
    rounded-full
    bg-white
    shadow-md
    transition-shadow transition-transform duration-200
    hover:shadow-xl hover:shadow-black/40
    hover:-translate-y-0.5
  "
  >
    <ExpandCircleDownIcon className="!text-[32px]" />
  </button>

  <div className='
h-full 

w-1/4
bg-white/50
               '>

    <div
      onClick={() => { changing_default_display_company_parent("minimal_company_display") }}
      className='
bg-white
border
h-10 
w-full
bg-black
rounded-xl
hover:bg-black/30
flex
justify-center
items-center
text-black
'>
      Minimal
    </div>
    <div
      onClick={() => { changing_default_display_company_parent("default_company_display") }}
      className='
bg-white
border
h-10 
w-full
bg-black
rounded-xl
hover:bg-black/30
flex
justify-center
items-center
text-black
'>
      Medium
    </div>


  </div>
  <div className='
h-full 

w-1/4
bg-white/50
               '>

    <button onClick={() => onEdgeFilterChange("all")}>All edges</button>
    <button onClick={() => onEdgeFilterChange("person")}>Person only</button>
    <button onClick={() => onEdgeFilterChange("location")}>Location only</button>
  </div>
  <div className='
h-full 

w-1/4
bg-white/50


               '>
    <div
      onClick={() => onEdgeFilterChange("all")}
      className='
bg-white
border
h-10 
w-full
bg-black
rounded-xl
hover:bg-black/30
flex
justify-center
items-center
text-black

'>
      ALL
    </div>
    <div
      onClick={() => onEdgeFilterChange("person")}
      className='
bg-white
border
h-10 
w-full
bg-black
rounded-xl
hover:bg-black/30
flex
justify-center
items-center
text-black

'>
      <FaceIcon />
    </div>
    <div
      onClick={() => onEdgeFilterChange("location")}
      className='
bg-white
border
h-10 
w-full
bg-black
rounded-xl
hover:bg-black/30
flex
justify-center
items-center
text-black

'>
      <LocationOnIcon />
    </div>

  </div>

</div>


