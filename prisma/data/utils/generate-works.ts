import { uuidv7 } from 'uuidv7';

const topics = [
  'Machine Learning',
  'Data Science',
  'Scientific Computing',
  'Numerical Analysis',
  'Optimization',
  'Visualization',
  'High Performance Computing',
  'Bioinformatics',
  'Astronomy',
  'Physics',
  'Chemistry',
  'Engineering',
  'Statistics',
  'Signal Processing',
  'Image Processing',
];

const adjectives = [
  'Advanced',
  'Novel',
  'Efficient',
  'Scalable',
  'Robust',
  'Parallel',
  'Distributed',
  'Real-time',
  'Interactive',
  'Automated',
  'Intelligent',
  'Adaptive',
  'Dynamic',
  'Predictive',
  'Optimized',
];

const methods = [
  'Approach',
  'Framework',
  'System',
  'Algorithm',
  'Methodology',
  'Technique',
  'Solution',
  'Implementation',
  'Analysis',
  'Model',
];

function generateRandomTitle() {
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const method = methods[Math.floor(Math.random() * methods.length)];
  return `${adjective} ${method} for ${topic}`;
}

function generateWork(index: number) {
  const workId = uuidv7();
  const versionId = uuidv7();
  const jobId = uuidv7();
  const submissionId = uuidv7();
  const submissionVersionId = uuidv7();
  const date = new Date('2024-03-05T16:20:00.814Z');
  date.setDate(date.getDate() - index); // Subtract days based on index to make older items appear first
  return {
    id: workId,
    title: `${index} ${generateRandomTitle()}`,
    description: `A research article about ${topics[Math.floor(Math.random() * topics.length)]}`,
    authors: ['Steve Purves', 'Rowan Cockett'],
    date: date.toISOString(),
    kind: 'article',
    collection: '2023',
    doi: `99.123/work.${index}`,
    versions: [
      {
        id: versionId,
        cdn_key: uuidv7(),
        cdn: 'https://prv.curvenote.dev/',
        date_created: '2024-03-05T16:20:00.814Z',
        canonical: true,
        doi: `99.123/work.${index}.version`,
      },
    ],
    submission: {},
    job: {
      id: jobId,
      job_type: 'CLI_CHECK',
      status: 'COMPLETED',
      payload: {
        key: `scipy-seed-dev-${index}`,
        site: 'scipy',
        source: {
          path: '',
          repo: 'github.com/stevejpurves/simple-test',
          branch: 'main',
          commit: 'e724b68',
        },
      },
      results: {
        cdnKey: uuidv7(),
        checks: {
          kind: 'Proceeding',
          venue: 'scipy',
          report: [
            {
              id: 'abstract-exists',
              file: '/Users/stevejpurves/dev/demos/simple/paper.md',
              help: 'Add an abstract',
              tags: ['frontmatter', 'abstract'],
              title: 'Abstract Exists',
              status: 'fail',
              message: 'No abstract found',
              purpose: 'ensure abstract exists',
            },
          ],
        },
        workId,
        submissionId,
        workVersionId: versionId,
        submissionVersionId,
      },
    },
  };
}

// Generate 100 works
const works = Array.from({ length: 5 }, (_, i) => generateWork(i));

// Export the works array
export default works;
