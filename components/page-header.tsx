export default function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex shrink-0 flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 border-l-[3px] border-[#c9973a] pl-3.5">
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#c9973a] uppercase">
          IT Department · Project Management
        </p>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-bold tracking-tight text-[#193956]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#5c6b7a]">{description}</p>
      </div>
      {children}
    </div>
  );
}
