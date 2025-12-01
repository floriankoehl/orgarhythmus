import { Handle } from "reactflow";
import StoreIcon from '@mui/icons-material/Store';
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import { useState } from "react";




function MainCompanyDisplay({ id, data, selected }) {
    const navigate = useNavigate();

    return (
        <>
            <div className={`
${selected ? 'bg-gradient-to-br from-indigo-400 to-purple-500' : 'bg-gradient-to-br from-indigo-300 to-purple-400'}


min-w-50
rounded
shadow-xl

gap-3


!p-2
flex
justify-center
items-center
flex-col
text-xl
relative
  rounded-2xl 
  bg-purple-500/15
  backdrop-blur-xl 
  border border-white/30 
  shadow-xl
  !py-6


            `}>
                <h1 className="m-2 ">{data.label}</h1>
                <Handle type="source" position="bottom" />
                <Handle type="target" position="top" />
                <button
          onClick={(e) => {
            e.stopPropagation();       
            navigate(`/company/${id}`);   
          }}
          className="bg-white !p-1   flex gap-3 justify-center items-center rounded hover:bg-blue-200 "
        > Detail Page
          <ExternalLink size={20} />
        </button>
            </div>
        </>
    )
}

function DefaultCompanyDisplay({ id, selected, data }) {
    const [expanded, setExpanded] = useState(false)

    console.log("Expanded state for: ", id, expanded)

    const navigate = useNavigate();

    return (
        <div 
        onDoubleClick={(e)=>{
                e.stopPropagation();
                data.changeNodeType(id, "minimal_company_display");
            }}
        className={`
${selected ? 'bg-blue-500/20 shadow-xl shadow-black/20' : 'bg-blue-400/15 '}
h-32
w-45
rounded
shadow-xl
!p-3
flex
flex-col
gap-2
justify-center
items-center
text-black

relative
  rounded-2xl 
  
  backdrop-blur-xl 
  border border-white/30 
  shadow-xl
  p-6

                    
                    
                    `}>
            {data.label}
            <Handle type="source" position="bottom" />
            <Handle type="target" position="top" />
            <div className="flex gap-2 justify-center">


                {!expanded ? 
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        // console.log("Expand triggered, i am : ", id)
                        setExpanded(true)
                        data.fetchCompany(id)

                    }}
                    className="bg-white p-2 w-8 h-8 flex justify-center items-center rounded hover:bg-gray-200">

                    <OpenInFullIcon className="!text-[25px]" />
                </div> :
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(false)
                        // console.log("Collapse triggered, i am : ", id)
                        data.collapseCompany(id);
                    }}
                    className="bg-white p-2 w-8 h-8 flex justify-center items-center rounded hover:bg-gray-200">
                    <CloseFullscreenIcon className="!text-[25px]" />
                </div>
            
            }
                
                
                {/* Navigate to /graph/:id */}
        <button
          onClick={(e) => {
            e.stopPropagation();       
            navigate(`/graph/${id}`);   
          }}
          className="bg-white p-2 w-8 h-8 flex justify-center items-center rounded hover:bg-gray-200 "
        >
          <span className="flex items-center gap-2">
            
            <ExternalLink size={22} />
          </span>
        </button>


            </div>

        </div>
    );
}

function MinimalCompanyDisplay(props){
    const { id, selected, data } = props;
    return (
        <>
            <div 
            onDoubleClick={(e)=>{
                e.stopPropagation();
                data.changeNodeType(id, "default_company_display");
            }}
            className="h-15 w-15 bg-white rounded-full flex justify-center items-center shadow-xl shadow-black/20">
                <StoreIcon className="!text-[35px]"/>
                <Handle type="source" position="bottom" />
                <Handle type="target" position="top" />       
            </div>
        </>
    )
}







export const companyNodeTypes = {
  default_company_display: DefaultCompanyDisplay,
  main_company_display: MainCompanyDisplay,
  minimal_company_display: MinimalCompanyDisplay,
};