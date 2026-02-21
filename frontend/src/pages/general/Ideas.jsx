import IdeaBin from "../../components/ideas/IdeaBin";

export default function Ideas() {
  return (
    <div className="h-screen w-screen p-10 flex justify-center items-center select-none">
      <div className="h-full w-full bg-white shadow-2xl border border-gray-300 rounded overflow-hidden">
        <IdeaBin pinned />
      </div>
    </div>
  );
}

