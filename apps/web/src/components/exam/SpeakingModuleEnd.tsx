interface SpeakingModuleEndProps {
  moduleOrder: number;
  nextModuleOrder: number;
}

export default function SpeakingModuleEnd({ moduleOrder, nextModuleOrder }: SpeakingModuleEndProps) {
  return (
    <div className="exam-flow-content space-y-6">
      <h1 className="exam-flow-title">End of Module {moduleOrder}</h1>
      <p className="text-xl leading-9 text-slate-700 max-w-4xl">
        Select <strong>Next</strong> to continue to Module {nextModuleOrder}.
      </p>
    </div>
  );
}
