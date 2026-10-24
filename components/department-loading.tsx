export default function DepartmentLoading() {
  return (
    <div className="flex min-h-[50vh] flex-1 items-center justify-center bg-[#f4f7fb]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14" aria-hidden="true">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-[#d7e0ea] border-t-[#c9973a]" />
          <span className="absolute inset-[7px] rounded-full bg-[#1a3a5c]" />
        </div>
        <p className="text-sm font-medium text-[#193956]">Loading IT Department projects…</p>
      </div>
    </div>
  );
}
