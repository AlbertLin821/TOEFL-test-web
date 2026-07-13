const SPEAKING_TASKS = [
  {
    type: 'Listen and Repeat',
    description: 'Listen and repeat what you heard',
  },
  {
    type: 'Take an Interview',
    description: 'Answer questions from the interviewer',
  },
] as const;

export default function SpeakingSectionIntro() {
  return (
    <div className="exam-flow-content speaking-section-intro space-y-8">
      <h1 className="exam-flow-title speaking-section-intro-title">Speaking Section</h1>
      <p className="speaking-section-intro-body max-w-4xl">
        In the speaking section, you will answer 11 questions to demonstrate how well you can speak English. There are
        two types of tasks.
      </p>
      <table className="exam-section-task-table speaking-section-intro-table w-full max-w-4xl">
        <thead>
          <tr>
            <th scope="col">Type of Task</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {SPEAKING_TASKS.map((task) => (
            <tr key={task.type}>
              <td>{task.type}</td>
              <td>{task.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
