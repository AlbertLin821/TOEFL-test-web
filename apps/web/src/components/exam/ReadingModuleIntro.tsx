interface ReadingModuleIntroProps {
  moduleOrder: number;
  hasNextModuleInSection: boolean;
}

export default function ReadingModuleIntro({ moduleOrder, hasNextModuleInSection }: ReadingModuleIntroProps) {
  const moduleLabel = `Module ${moduleOrder}`;

  return (
    <div className="exam-flow-content space-y-6">
      <h1 className="exam-flow-title">Reading Section, {moduleLabel}</h1>
      <div className="space-y-4 text-slate-700 leading-relaxed max-w-4xl">
        <p>In an actual test, the clock will show you how much time you have to complete {moduleLabel}.</p>
        <p>
          You can use <strong>Next</strong> and <strong>Back</strong> to move to the next question or return to
          previous questions within the same module.
        </p>
        {hasNextModuleInSection && (
          <p>
            You WILL NOT be able to return to {moduleLabel} once you have begun Module {moduleOrder + 1}.
          </p>
        )}
      </div>
    </div>
  );
}
