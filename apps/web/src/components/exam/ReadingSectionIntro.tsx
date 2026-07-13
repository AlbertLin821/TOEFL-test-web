const READING_TASKS = [
  {
    type: 'Complete the Words',
    description: 'Fill in the missing letters in a paragraph.',
  },
  {
    type: 'Read in Daily Life',
    description: 'Answer questions about everyday reading material.',
  },
  {
    type: 'Read an Academic Passage',
    description: 'Answer questions about academic passages.',
  },
] as const;

export default function ReadingSectionIntro() {
  return (
    <div className="exam-flow-content reading-section-intro space-y-8">
      <h1 className="exam-flow-title reading-section-intro-title">Reading Section</h1>
      <p className="reading-section-intro-body max-w-4xl">
        In the Reading section, you will answer 35-48 questions to demonstrate how well you understand academic and
        non-academic texts in English, There are three types of tasks.
      </p>
      <table className="exam-section-task-table reading-section-intro-table w-full max-w-4xl">
        <thead>
          <tr>
            <th scope="col">Type of Task</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {READING_TASKS.map((task) => (
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
