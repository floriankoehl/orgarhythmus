/**
 * Ideas Page — renders the IdeaBin component in embedded (full-page) mode.
 * All idea/category/legend logic lives in IdeaBin (single source of truth).
 */
import IdeaBin from "../../components/ideas/IdeaBin";

export default function Ideas() {
  return (
    <div className="h-screen w-screen p-6 flex justify-center items-center select-none">
      <div className="h-full w-full max-w-[1600px]">
        <IdeaBin mode="embedded" />
      </div>
    </div>
  );
}
