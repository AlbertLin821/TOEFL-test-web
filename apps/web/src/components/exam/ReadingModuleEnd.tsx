interface ReadingModuleEndProps {
  moduleOrder: number;
  nextModuleOrder: number;
}

export default function ReadingModuleEnd({ moduleOrder, nextModuleOrder }: ReadingModuleEndProps) {
  return (
    <div className="exam-flow-content space-y-6">
      <h1 className="exam-flow-title">End of Module {moduleOrder}</h1>
      <p className="text-slate-700 leading-relaxed max-w-4xl">
        Select <strong>Next</strong> to continue to Module {nextModuleOrder}.
      </p>
    </div>
  );
}
