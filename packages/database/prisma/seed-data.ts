// Practice Test 1 content, extracted from toefl-ibt-teachers-resources-practice-test-1.pdf
// Audio files live under the local "題目音檔" folder and are uploaded to MinIO by seed.ts.

export interface ChoiceItemData {
  itemType: 'reading_single_choice' | 'listening_single_choice';
  questionText?: string;
  stimulusTitle?: string;
  stimulusText?: string;
  options: string[];
  correctIndex: number;
  /** relative path of audio file (for listening) */
  audioFile?: string;
  /** true when this item's audio is a shared conversation/talk played before the question group */
  groupAudio?: boolean;
  instructions?: string;
}

export interface FillBlankItemData {
  itemType: 'reading_fill_blank';
  instructions: string;
  template: string;
  answers: string[][];
}

export const READING_M1_FILL: FillBlankItemData = {
  itemType: 'reading_fill_blank',
  instructions: 'Fill in the missing letters in the paragraph. (Questions 1-10)',
  template:
    'Early civilizations, including those in Mesopotamia, Egypt, the Indus Valley, and China, emerged around river valleys, where fertile land and water resources supported agriculture. Th{{1}} developed sophis{{2}} social struc{{3}}, written lang{{4}}, and adva{{5}} technologies, wh{{6}} allowed th{{7}} to thr{{8}} and esta{{9}} cities, tr{{10}} networks, and even empires. Just as important were their significant contributions to fields like art, science, and law. These developments were crucial in shaping the course of human history.',
  answers: [['ey'], ['ticated'], ['tures'], ['uages'], ['nced'], ['ich'], ['em'], ['ive'], ['blish'], ['ade']],
};

/** Official answer key — Reading Section, Module 1 (Practice Test 1) */
export const READING_M1_ANSWER_KEY = {
  fillBlanks: ['ey', 'ticated', 'tures', 'uages', 'nced', 'ich', 'em', 'ive', 'blish', 'ade'],
  choices: ['B', 'D', 'D', 'B', 'A', 'D', 'C', 'B', 'C', 'A'],
} as const;

export const READING_M2_FILL: FillBlankItemData = {
  itemType: 'reading_fill_blank',
  instructions: 'Fill in the missing letters in the paragraph. (Questions 1-10)',
  template:
    "Consciousness is the state of being aware of and able to think about one's own existence, thoughts, and surroundings. Wh{{1}} you lo{{2}} in a mir{{3}} and recognize your{{4}}, you exh{{5}} self-awareness, wh{{6}} is n{{7}} unique t{{8}} humans b{{9}} is al{{10}} found in dolphins and great apes. Consciousness is not to be confused with cognition. The latter refers to mental processes involved in gaining knowledge and solving problems, like thinking, judging, and remembering.",
  answers: [['en'], ['ok'], ['ror'], ['self'], ['ibit'], ['ich'], ['ot'], ['o'], ['ut'], ['so']],
};

/** Official answer key — Reading Section, Module 2 (Practice Test 1) */
export const READING_M2_ANSWER_KEY = {
  fillBlanks: ['en', 'ok', 'ror', 'self', 'ibit', 'ich', 'ot', 'o', 'ut', 'so'],
  choices: ['B', 'B', 'C', 'C', 'A', 'B', 'C', 'D', 'A', 'D'],
} as const;

const NOTICE_TEXT =
  'This is to let all employees know that the staff meeting scheduled for Wednesday, August 10th at 2:00 PM has been rescheduled. The meeting will now take place on Friday, August 12th at 3:00 PM in the main conference room. Please be on time. Thank you.';

const EMAIL_SANTIAGO =
  "Subject: RE: inquiry\n\nDear Mr. Santiago,\n\nWe are pleased that you are considering our facility for your mother's birthday party.\n\nOur outdoor area includes a playground and picnic tables, which can be set up to your preference. We offer a variety of dining options that suit different dietary needs. Please find the menu attached to this email.\n\nOur team can organize activities for people of all ages, including arts and crafts, board games, and more. We do not have photographers on staff, but we have worked with external professional photographers in the past and are happy to provide you with recommendations.\n\nTo secure your date, we require a down payment of 30 percent of the total cost. If you need to cancel your booking, please notify us at least fourteen days in advance. Cancellations made outside this window will forfeit the down payment.\n\nRegards,\nRebecca Yang";

const BIRDS_PASSAGE =
  'Urbanization has had a profound impact on bird populations worldwide. As cities expand, natural habitats are replaced with buildings, roads, and other infrastructure. This leads to a significant reduction in the availability of nesting sites and food sources for birds.\n\nSome species, such as pigeons and sparrows, have adapted well to urban environments, taking advantage of the new resources and structures. However, many other species struggle to survive in these altered landscapes. Therefore, it is imperative to find solutions that help birds adapt to city life. One notable effect of urbanization is the change in bird song. Birds living in cities often sing at higher pitches and volumes than their rural counterparts. This adaptation helps them communicate over the noise of traffic and human activity. Additionally, the artificial lighting in cities can disrupt the natural circadian (daily time-related) rhythms of birds, affecting their breeding and feeding behaviors.\n\nConservationists are working to mitigate the negative effects of urbanization on birds. Initiatives such as creating urban green spaces, constructing bird-friendly buildings, and reducing light pollution are being implemented. These efforts aim to create a more hospitable environment for birds, allowing them to coexist with humans in urban settings.';

export const READING_M1_CHOICES: ChoiceItemData[] = [
  {
    itemType: 'reading_single_choice',
    instructions: 'Read a notice.',
    stimulusTitle: 'Notice',
    stimulusText: NOTICE_TEXT,
    questionText: 'What is the main purpose of the notice?',
    options: [
      'To introduce new employees to staff',
      'To announce a change in a meeting schedule',
      'To apologize for a scheduling conflict',
      'To inform employees of a conference opportunity',
    ],
    correctIndex: 1,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'Notice',
    stimulusText: NOTICE_TEXT,
    questionText: 'When will the staff meeting take place?',
    options: [
      'Wednesday, August 10th at 2:00 PM',
      'Wednesday, August 10th at 3:00 PM',
      'Friday, August 12th at 2:00 PM',
      'Friday, August 12th at 3:00 PM',
    ],
    correctIndex: 3,
  },
  {
    itemType: 'reading_single_choice',
    instructions: 'Read an email.',
    stimulusTitle: 'Email',
    stimulusText: EMAIL_SANTIAGO,
    questionText: 'What can be inferred about Mr. Santiago?',
    options: [
      'He is about to celebrate his birthday.',
      "He has used Rebecca Yang's facility in the past.",
      'He is a professional event organizer.',
      "He has requested information about Rebecca Yang's facility.",
    ],
    correctIndex: 3,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'Email',
    stimulusText: EMAIL_SANTIAGO,
    questionText: "Rebecca Yang's team does NOT include",
    options: [
      'Cooks',
      'Professional photographers',
      "People who can facilitate children's games",
      'People who can set up picnic tables',
    ],
    correctIndex: 1,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'Email',
    stimulusText: EMAIL_SANTIAGO,
    questionText: 'What information is being provided along with the email message?',
    options: [
      'Food choices',
      'Types of arts and crafts activities',
      'Dates available for booking',
      'Contact information of photographers',
    ],
    correctIndex: 0,
  },
  {
    itemType: 'reading_single_choice',
    instructions: 'Read an academic passage.',
    stimulusTitle: 'The Effects of Urbanization on Bird Populations',
    stimulusText: BIRDS_PASSAGE,
    questionText: 'The word "mitigate" in the passage is closest in meaning to',
    options: ['understand', 'analyze', 'communicate', 'reduce'],
    correctIndex: 3,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'The Effects of Urbanization on Bird Populations',
    stimulusText: BIRDS_PASSAGE,
    questionText:
      'Which of the following is NOT mentioned as an effect of urbanization on birds in the passage?',
    options: [
      'Reduced availability of nesting sites',
      'Changes in bird song',
      'Increased food sources',
      'Disrupted circadian rhythms',
    ],
    correctIndex: 2,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'The Effects of Urbanization on Bird Populations',
    stimulusText: BIRDS_PASSAGE,
    questionText: 'Why does the author mention pigeons and sparrows?',
    options: [
      'To identify birds that struggle to survive in urban environments',
      'To give examples of birds that have adjusted to living in urban settings',
      'To highlight the diversity of urban bird species',
      'To suggest that all birds can adapt to cities',
    ],
    correctIndex: 1,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'The Effects of Urbanization on Bird Populations',
    stimulusText: BIRDS_PASSAGE,
    questionText: 'What is one initiative mentioned in the passage to help birds in urban areas?',
    options: [
      'Introducing new bird species to urban areas',
      'Providing human-made food sources to birds',
      'Creating urban green spaces',
      'Decreasing the amount of noise made by traffic',
    ],
    correctIndex: 2,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'The Effects of Urbanization on Bird Populations',
    stimulusText: BIRDS_PASSAGE,
    questionText: 'What can be inferred about the impact artificial lighting in cities has on birds?',
    options: [
      'It disrupts the natural behaviors of birds.',
      'It allows birds to find food at night.',
      'It helps birds to adapt to urban environments.',
      'It increases the population of urban birds.',
    ],
    correctIndex: 0,
  },
];

const EMAIL_SIMMONS =
  "Dear Ms. Simmons,\n\nWe are delighted to confirm your reservation for the Italian cooking class on June 25th at 4:00 PM. Please arrive fifteen minutes early for registration. Bring an apron, a chef's knife, and a notebook. We'll provide a cutting board.\n\nBest regards,\nLily Evans";

const EMAIL_ADAMS =
  'Subject: Annual conference\n\nDear Ms. Adams,\n\nWe are pleased to invite you to the annual educational psychology conference taking place on October 13-15.\n\nThis year\'s conference theme is "Emotions and Psychological Processes." The keynote speaker will be Dr. Jane Smith. We will also organize four panel discussions with leading scholars as well as interactive workshops. More details will be forthcoming.\n\nWe are excited to announce the return of poster sessions this year, where graduate students and early-career researchers will present their work. If you would like to present your research in the poster session, please submit an extended abstract for review by the conference committee by August 31.\n\nBreakfast and lunch will be provided for a nominal fee with a variety of options to accommodate different dietary needs. Additionally, all attendees will receive a conference packet, including materials from the sessions and a certificate of participation.\n\nRegards,\nMichael Brown';

const PHOTO_PASSAGE =
  'The history of photography is marked by significant technological progress and artistic innovation. It began in the early nineteenth century with the invention of the camera obscura, a device that projected images onto a surface. The first permanent photograph was created by Joseph-Nicephore Niepce in 1826 using a process called heliography, which required several hours of exposure to light.\n\nPhotography quickly evolved with the development of daguerreotypes, introduced by Louis Daguerre in 1839. This method produced detailed images on silver-plated copper, but daguerreotypes needed delicate handling, and the exposure times required, although much shorter, still remained impractical for recording images of moving objects. The invention of the calotype by William Henry Fox Talbot in the 1840s allowed for multiple copies of an image to be made from a single negative, revolutionizing the field. (A) In the late nineteenth and early twentieth centuries, the introduction of film and roll cameras made photography more accessible to the public. (B) George Eastman\'s establishment of the Kodak company in 1888 played a crucial role in this democratization, as his cameras were simple to use and affordable. (C) Today, digital photography has further transformed the medium, allowing instant image capture and sharing. (D)';

export const READING_M2_CHOICES: ChoiceItemData[] = [
  {
    itemType: 'reading_single_choice',
    instructions: 'Read an email.',
    stimulusTitle: 'Email',
    stimulusText: EMAIL_SIMMONS,
    questionText: 'What is the main purpose of the e-mail?',
    options: [
      'To request attendance at a class',
      'To confirm a reservation for a class',
      'To update travel plans',
      'To provide registration instructions',
    ],
    correctIndex: 1,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'Email',
    stimulusText: EMAIL_SIMMONS,
    questionText: 'What is Ms. Simmons NOT required to bring?',
    options: ['An apron', 'A cutting board', "A chef's knife", 'A notebook'],
    correctIndex: 1,
  },
  {
    itemType: 'reading_single_choice',
    instructions: 'Read an email.',
    stimulusTitle: 'Email',
    stimulusText: EMAIL_ADAMS,
    questionText: 'What is the main purpose of the email?',
    options: [
      "To request information about Ms. Adams' research",
      'To invite Ms. Adams to speak at a conference',
      'To provide details about an event',
      'To announce participants of the poster sessions',
    ],
    correctIndex: 2,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'Email',
    stimulusText: EMAIL_ADAMS,
    questionText: 'Dr. Jane Smith will',
    options: [
      'lead panel discussions',
      'organize interactive workshops',
      'talk about research about emotions',
      'present her research in the poster session',
    ],
    correctIndex: 2,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'Email',
    stimulusText: EMAIL_ADAMS,
    questionText: 'What can be inferred about the poster session?',
    options: [
      'It has been part of the conference in the past.',
      'It is for leading scholars of the field.',
      'It is open to the public.',
      'It will be held on August 31.',
    ],
    correctIndex: 0,
  },
  {
    itemType: 'reading_single_choice',
    instructions: 'Read an academic passage.',
    stimulusTitle: 'The History of Photography',
    stimulusText: PHOTO_PASSAGE,
    questionText: 'The word "innovation" in the passage is closest in meaning to',
    options: ['success', 'advancement', 'activity', 'expression'],
    correctIndex: 1,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'The History of Photography',
    stimulusText: PHOTO_PASSAGE,
    questionText: 'What is suggested about daguerreotypes?',
    options: [
      'They were introduced by Joseph-Nicephore Niepce.',
      'They allowed for multiple copies of an image.',
      'They required shorter exposure times than heliographs did.',
      'They made it unnecessary to use silver-plated copper.',
    ],
    correctIndex: 2,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'The History of Photography',
    stimulusText: PHOTO_PASSAGE,
    questionText: 'How did the calotype revolutionize photography?',
    options: [
      'By enabling instant image capture',
      'By reducing the need for delicate handling',
      'By providing detailed images on silver-plated copper',
      'By allowing multiple copies from a single negative',
    ],
    correctIndex: 3,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'The History of Photography',
    stimulusText: PHOTO_PASSAGE,
    questionText: "Why does the author mention George Eastman's establishment of the Kodak company?",
    options: [
      'To highlight the role of Kodak in making photography accessible to the public',
      'To criticize the challenges of early photographic methods',
      'To explain how film was invented',
      'To suggest that Kodak introduced digital photography',
    ],
    correctIndex: 0,
  },
  {
    itemType: 'reading_single_choice',
    stimulusTitle: 'The History of Photography',
    stimulusText: PHOTO_PASSAGE,
    questionText:
      'There are four locations (A, B, C, and D) in the passage that indicate where the following sentence could be added.\n\n"These developments have rendered the use of film and many types of cameras obsolete."\n\nWhere would the sentence best fit? Select a location where the sentence could be added to the passage.',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: 3,
  },
];

/** Reading Module 2 — email to Ms. Simmons, Questions 11-12 */
export const READING_M2_Q11_12: ChoiceItemData[] = READING_M2_CHOICES.slice(0, 2);

/** Reading Module 2 — Adams conference email, Questions 13-15 */
export const READING_M2_Q13_15: ChoiceItemData[] = READING_M2_CHOICES.slice(2, 5);

/** Reading Module 2 — all single-choice items currently enabled (Q11-15) */
export const READING_M2_Q11_15: ChoiceItemData[] = READING_M2_CHOICES.slice(0, 5);

/** Reading Module 2 — photography passage, Questions 16-20 */
export const READING_M2_Q16_20: ChoiceItemData[] = READING_M2_CHOICES.slice(5, 10);

/** Reading Module 2 — all single-choice items currently enabled (Q11-20) */
export const READING_M2_Q11_20: ChoiceItemData[] = READING_M2_CHOICES.slice(0, 10);

const AUDIO_BASE =
  'Teacher Practice Test 1 Audio Files-20260707T125645Z-3-001/Teacher Practice Test 1 Audio Files';

export const LISTENING_M1: ChoiceItemData[] = [
  ...[
    { correct: 1, options: ["No, I haven't received it yet.", "Yes, it's just around the corner.", "Let's walk to the park.", 'Several times a month.'] },
    { correct: 3, options: ['No, the airport is on the right.', 'Yes, I loved that book!', "I'd be happy to sell tickets for the fundraiser.", "I'm going to New Zealand instead."] },
    { correct: 0, options: ['Elizabeth would be the person to ask.', "We'll be gathering in the main conference room.", 'Did Robert place the food order?', 'The train station closes at midnight.'] },
    { correct: 0, options: ['Are you looking for the same color?', 'Yes, we stock a variety of styles of pants.', 'All of our stores are open on Sundays.', 'The store will be remodeled this summer.'] },
    { correct: 3, options: ['The suitcases can be stored overhead.', "Because I have a doctor's appointment.", 'I know you have some vacation time coming up.', 'She was offered a new role.'] },
    { correct: 1, options: ['Did you watch the game yesterday?', 'They start at a hundred dollars.', 'These models feature a new display.', 'The admission fee has gone up by twenty dollars.'] },
    { correct: 2, options: ['Battery recycling is available on Saturdays.', 'The cost of those phones just went up.', "There's a shopping center a few minutes from here.", 'The cashier charged me too much.'] },
    { correct: 1, options: ["I don't have a cleaning service.", "I'm too busy to watch anything right now.", 'The stream runs behind the house.', 'The magazine subscription is expensive.'] },
  ].map((q, i) => ({
    itemType: 'listening_single_choice' as const,
    instructions: 'Choose the best response.',
    options: q.options,
    correctIndex: q.correct,
    audioFile: `${AUDIO_BASE}/Listening/Listen and Response/Listening1_Listen_Response_Question${i + 1}.mp3`,
  })),
  {
    itemType: 'listening_single_choice',
    instructions: 'Listen to a conversation.',
    questionText: 'What kind of job does the man most likely have?',
    options: ['Fitness instructor', 'Driver', 'Office worker', 'Equipment manufacturer'],
    correctIndex: 2,
    audioFile: `${AUDIO_BASE}/Listening/Short Conversation/Listening1_Conversation_Questions_9-10.mp3`,
    groupAudio: true,
  },
  {
    itemType: 'listening_single_choice',
    questionText: 'What does the man indicate about weekends?',
    options: [
      'He sometimes needs to go to work on weekends.',
      'He sometimes repairs equipment in his house on weekends.',
      'He likes to exercise outdoors on weekends.',
      'He exercises more on weekends than on other days.',
    ],
    correctIndex: 3,
  },
  {
    itemType: 'listening_single_choice',
    instructions: 'Listen to a conversation.',
    questionText: 'Why does the woman need professional help?',
    options: [
      'Her computer is not working properly.',
      'She needs to choose a new computer.',
      'She needs new software on her computer.',
      'She has lost access to her email.',
    ],
    correctIndex: 0,
    audioFile: `${AUDIO_BASE}/Listening/Short Conversation/Listening1_Conversation_Questions_11-12.mp3`,
    groupAudio: true,
  },
  {
    itemType: 'listening_single_choice',
    questionText: 'What will the man do after the meeting?',
    options: ['Offer the woman some advice', 'Call a downtown shop', 'Get his computer fixed', 'Share some contact information'],
    correctIndex: 3,
  },
  {
    itemType: 'listening_single_choice',
    instructions: 'Listen to an announcement on the campus radio station.',
    questionText: 'Who is the intended audience of the lectures?',
    options: ['Science students', 'University professors', 'Everyone at the science fair', 'A panel of judges'],
    correctIndex: 2,
    audioFile: `${AUDIO_BASE}/Listening/Announcements/Listening1_Announcement_Questions_13-14.mp3`,
    groupAudio: true,
  },
  {
    itemType: 'listening_single_choice',
    questionText: 'What does the speaker hope the listeners will do?',
    options: ['Attend an event', 'Submit a science project', 'Join the university gym', 'Volunteer for an event'],
    correctIndex: 0,
  },
  {
    itemType: 'listening_single_choice',
    instructions: 'Listen to a talk in an anthropology class.',
    questionText:
      'What aspect of the Indigenous peoples of the Northwest coast of North America is the talk mainly about?',
    options: [
      'Their economic structures',
      'A traditional event that they participate in',
      'Their relationship with the Canadian government',
      'The role of dancing and storytelling in their social functions',
    ],
    correctIndex: 1,
    audioFile: `${AUDIO_BASE}/Listening/Academic Talk/Listening1_Academic Talk_Questions_15-18.mp3`,
    groupAudio: true,
  },
  {
    itemType: 'listening_single_choice',
    questionText: 'What can a host gain from a potlatch?',
    options: ['Food', 'Money', 'Items like blankets', 'Social status'],
    correctIndex: 3,
  },
  {
    itemType: 'listening_single_choice',
    questionText: 'What does the speaker imply about the Canadian government of the late-nineteenth century?',
    options: [
      'It was not aware of the social function of potlatches.',
      'It wanted Indigenous people to include other Canadians in potlatches.',
      'Its policies contributed to economic growth.',
      'It was extremely wasteful.',
    ],
    correctIndex: 0,
  },
  {
    itemType: 'listening_single_choice',
    questionText: 'What aspect of potlatches will the speaker discuss next?',
    options: [
      'The ways in which communities brought them back',
      'The countries that ban them',
      'Their effect on wealth distribution',
      'Their possible future',
    ],
    correctIndex: 0,
  },
];

export const LISTENING_M2: ChoiceItemData[] = [
  ...[
    { correct: 0, options: ['My professor is out this week.', 'The syllabus was just posted.', "Yes, it's in my backpack.", "I don't think I received one."] },
    { correct: 1, options: ["It's a quiet neighborhood.", "I haven't yet.", "Yes, I'll drop it off tomorrow.", 'Not usually at this time of day.'] },
    { correct: 3, options: ['Sure, you can borrow my charging cord.', 'The door should remain shut and locked.', 'Because the schedule was changed at the last minute.', 'Sounds like it needs to be repaired.'] },
    { correct: 2, options: ['I just met his assistant.', "The cafeteria closes at 2 o'clock.", "He's working late tonight.", 'Because I lost mine.'] },
    { correct: 2, options: ['They usually study together.', 'The library is past the cafeteria.', "I think it's time to do it.", 'Some new classroom equipment.'] },
    { correct: 0, options: ["I'll put them on your desk.", "Yes, I'll pass along the message.", 'I like that new coffee maker.', 'No, the other textbook.'] },
    { correct: 3, options: ['I was able to make it to the trade show.', 'I do not play any instruments.', 'My manager agreed to the new schedule.', 'It was a very long drive.'] },
    { correct: 1, options: ['The menu features two fish entrees.', 'It depends on the season.', 'The cost of broccoli has increased.', 'Yes, the natural lighting is lovely.'] },
  ].map((q, i) => ({
    itemType: 'listening_single_choice' as const,
    instructions: 'Choose the best response.',
    options: q.options,
    correctIndex: q.correct,
    audioFile: `${AUDIO_BASE}/Listening/Listen and Response/Listening2_Listen_Response_Question${i + 1}.mp3`,
  })),
  {
    itemType: 'listening_single_choice',
    instructions: 'Listen to a conversation.',
    questionText: 'What does the woman offer to help with?',
    options: ['Deciding which products to sell', 'Finding new clients', 'Producing goods', 'Describing items for sale'],
    correctIndex: 3,
    audioFile: `${AUDIO_BASE}/Listening/Short Conversation/Listening2_Conversation_Question_9-10.mp3`,
    groupAudio: true,
  },
  {
    itemType: 'listening_single_choice',
    questionText: 'Why does the woman mention a client?',
    options: [
      'To emphasize the need for an online store',
      'To propose a strategy for increasing sales',
      'To illustrate the importance of collaboration',
      'To explain why she prefers not to plan a meeting after lunch',
    ],
    correctIndex: 3,
  },
  {
    itemType: 'listening_single_choice',
    instructions: 'Listen to an announcement in a classroom.',
    questionText: 'What is the reason for the change described in the announcement?',
    options: ['Repairs to a classroom', 'Increased class enrollment', 'A change in meeting time', 'An additional assignment'],
    correctIndex: 1,
    audioFile: `${AUDIO_BASE}/Listening/Announcements/Listening2_Announcement_Questions_11-12.mp3`,
    groupAudio: true,
  },
  {
    itemType: 'listening_single_choice',
    questionText: 'Why does the speaker mention the east wing?',
    options: [
      'To announce the location of an event',
      'To notify students of upcoming repairs',
      "To direct students to the professor's office",
      'To help students find a classroom',
    ],
    correctIndex: 3,
  },
  {
    itemType: 'listening_single_choice',
    instructions: 'Listen to a talk in an economics class.',
    questionText: 'What is the main topic of the talk?',
    options: [
      'The advantages of traditional employment',
      'The benefits of using apps instead of websites',
      'A new type of work tied to advances in technology',
      'A plan to restructure contract work',
    ],
    correctIndex: 2,
    audioFile: `${AUDIO_BASE}/Listening/Academic Talk/Listening2_Academic Talk_Questions_13-16.mp3`,
    groupAudio: true,
  },
  {
    itemType: 'listening_single_choice',
    questionText: 'Why does the speaker mention ride-sharing apps and freelance websites?',
    options: [
      'To give examples of digital platforms in the gig economy',
      'To explain a problem with overhead costs',
      'To discuss how work conditions for gig workers have improved',
      'To illustrate technologies used both by companies and by their customers',
    ],
    correctIndex: 0,
  },
  {
    itemType: 'listening_single_choice',
    questionText: 'According to the speaker, what is a challenge for gig workers?',
    options: ['High overhead costs', 'Limited flexibility', 'Lack of a stable income', 'Little office space'],
    correctIndex: 2,
  },
  {
    itemType: 'listening_single_choice',
    questionText: 'What will the speaker discuss next?',
    options: [
      'The challenges of digital platforms for gig workers',
      'The efforts of regulators to protect gig workers',
      'The types of labor markets with many gig workers',
      'The advantages of flexible working hours for gig workers',
    ],
    correctIndex: 1,
  },
];

export interface SentenceOrderItemData {
  questionText: string;
  prefix?: string;
  suffix?: string;
  tokens: string[];
  correctOrder: string[];
  acceptedSentence: string;
}

export const BUILD_A_SENTENCE: SentenceOrderItemData[] = [
  {
    questionText: 'What did Andre ask you at the party?',
    suffix: '.',
    tokens: ['wanted', 'does', 'he', 'ended', 'when', 'to know', 'it'],
    correctOrder: ['he', 'wanted', 'to know', 'when', 'it', 'ended'],
    acceptedSentence: 'He wanted to know when it ended.',
  },
  {
    questionText: 'Why was the meeting rescheduled?',
    suffix: '.',
    tokens: ['was moved', 'to', 'it', 'a time', 'when', 'everyone', 'could attend'],
    correctOrder: ['it', 'was moved', 'to', 'a time', 'when', 'everyone', 'could attend'],
    acceptedSentence: 'It was moved to a time when everyone could attend.',
  },
  {
    questionText: 'I just spoke with the boss about applying for the open position.',
    prefix: 'I am',
    suffix: '.',
    tokens: ['curious', 'if', 'mentioned', 'any specific requirements', 'because', 'he'],
    correctOrder: ['curious', 'if', 'he', 'mentioned', 'any specific requirements'],
    acceptedSentence: 'I am curious if he mentioned any specific requirements.',
  },
  {
    questionText: 'Why are you asking about the new restaurant?',
    prefix: 'My',
    suffix: '.',
    tokens: ['is wondering', 'it', 'when', 'is going', 'to open', 'she', 'friend', 'Jenna'],
    correctOrder: ['friend', 'Jenna', 'is wondering', 'when', 'it', 'is going', 'to open'],
    acceptedSentence: 'My friend Jenna is wondering when it is going to open.',
  },
  {
    questionText: 'Do you know anyone who can give me directions to the Big Tree Bistro?',
    suffix: '.',
    tokens: ['there', 'to get', 'how', 'think', 'I', 'where', 'knows', 'Sally'],
    correctOrder: ['I', 'think', 'Sally', 'knows', 'how', 'to get', 'there'],
    acceptedSentence: 'I think Sally knows how to get there.',
  },
  {
    questionText: 'What are your plans for the summer?',
    suffix: 'yet.',
    tokens: ['I', "don't", "I'm", 'where', 'to do', 'going', 'know', 'what'],
    correctOrder: ['I', "don't", 'know', 'what', "I'm", 'going', 'to do'],
    acceptedSentence: "I don't know what I'm going to do yet.",
  },
  {
    questionText: 'What did Ruby ask about the new software?',
    prefix: 'She wanted',
    suffix: '.',
    tokens: ['help', 'however', 'if', 'it', 'to know', 'with', 'need', 'you'],
    correctOrder: ['to know', 'if', 'you', 'need', 'help', 'with', 'it'],
    acceptedSentence: 'She wanted to know if you need help with it.',
  },
  {
    questionText: 'Why did Gustavo call you this morning?',
    prefix: 'He wanted',
    suffix: '.',
    tokens: ['where', 'a leak', 'could find', 'he', 'to know', 'a plumber', 'to fix', 'is'],
    correctOrder: ['to know', 'where', 'he', 'could find', 'a plumber', 'to fix', 'a leak'],
    acceptedSentence: 'He wanted to know where he could find a plumber to fix a leak.',
  },
  {
    questionText: 'I heard that the supervisor was looking for you.',
    prefix: 'She',
    suffix: '.',
    tokens: ['we', 'wanted', 'to finish', 'finished', 'to know', 'when', 'the project', 'expect'],
    correctOrder: ['wanted', 'to know', 'when', 'we', 'expect', 'the project', 'to finish'],
    acceptedSentence: 'She wanted to know when we expect the project to finish.',
  },
  {
    questionText: 'Julio said you had a question about the research paper.',
    prefix: "I'm hoping",
    suffix: '.',
    tokens: ['me', 'you', 'can', 'tell', 'where', 'some reliable sources', 'find', 'I might'],
    correctOrder: ['you', 'can', 'tell', 'me', 'where', 'I might', 'find', 'some reliable sources'],
    acceptedSentence: "I'm hoping you can tell me where I might find some reliable sources.",
  },
];

export const WRITE_AN_EMAIL = {
  instructions:
    'You will read some information and use the information to write an email. You will have 7 minutes to write the email.',
  scenario:
    'You are planning a business trip to another city. Your colleague, Maria, recently traveled to the same city for work. You want to ask her recommendations for places to eat and things to do during your free time.',
  taskPoints: [
    'Explain why you are traveling to the city.',
    'Ask for her recommendations about restaurants and activities.',
    "Mention what you'd most like to do and what you'd like to avoid.",
  ],
  to: 'Maria',
  subject: 'Recommendations for Upcoming Business Trip',
};

export const ACADEMIC_DISCUSSION = {
  instructions:
    'A professor has posted a question about a topic and students have responded with their thoughts and ideas. Make a contribution to the discussion. You will have 10 minutes to write.',
  context:
    "Your professor is teaching a course on labor studies. Write a post responding to the professor's question. In your response, you should express and support your opinion, and make a contribution to the discussion in your own words. An effective response will contain at least 100 words.",
  professorName: 'Professor',
  professorQuestion:
    'More and more people can work remotely on portable electronic devices rather than in a dedicated office. These workers often have more flexibility regarding when and where they work, allowing them to become what are known as "digital nomads" - that is, workers who travel regularly and work from different locations, both inside and outside their own countries. Do you think digital nomadism is likely to continue increasing? Why or why not?',
  studentPosts: [
    {
      name: 'Claire',
      text: "While digital nomadism does offer unparalleled freedom, it's important to note that it heavily relies on strong Internet connectivity. This requirement can significantly limit the destinations one can choose to work from, so digital nomadism probably won't increase globally as much as some people think.",
    },
    {
      name: 'Andre',
      text: 'While Claire makes a good point, Internet technologies and speed are always improving, so I think digital nomadism will continue to grow. Why work in a stuffy city office building just so you can afford to travel to someplace beautiful once or twice a year when you could work from such places all year round?',
    },
  ],
  minWords: 100,
};

export interface ListenRepeatItemData {
  expectedText: string;
  responseSeconds: number;
  audioFile: string;
  highlightCell: WeatherGridCell;
}

export type WeatherGridCell =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'temperature'
  | 'wind'
  | 'outlook';

export const LISTEN_AND_REPEAT_INTRO = {
  instructions:
    'You will listen as someone speaks to you. Listen carefully and then repeat what you have heard. The clock will indicate how much time you have to speak. No time for preparation will be provided.',
  scenario:
    'You are learning how to give the weather report for the university radio station. Listen to the speaker and repeat what she says. Repeat only once.',
  directionsAudio: `${AUDIO_BASE}/Speaking/Listen and Repeat/Speaking_Listen_Repeat_Directions.mp3`,
};

export const LISTEN_AND_REPEAT: ListenRepeatItemData[] = [
  {
    expectedText: 'Welcome to our event.',
    responseSeconds: 8,
    audioFile: `${AUDIO_BASE}/Speaking/Listen and Repeat/Speaking_Listen_Repeat_Question1.mp3`,
    highlightCell: 'morning',
  },
  {
    expectedText: 'Get your name badge at the registration desk.',
    responseSeconds: 8,
    audioFile: `${AUDIO_BASE}/Speaking/Listen and Repeat/Speaking_Listen_Repeat_Question2.mp3`,
    highlightCell: 'afternoon',
  },
  {
    expectedText: 'Our event is in the auditorium.',
    responseSeconds: 8,
    audioFile: `${AUDIO_BASE}/Speaking/Listen and Repeat/Speaking_Listen_Repeat_Question3.mp3`,
    highlightCell: 'evening',
  },
  {
    expectedText: 'For small group sessions, we will be in the breakout rooms over here.',
    responseSeconds: 10,
    audioFile: `${AUDIO_BASE}/Speaking/Listen and Repeat/Speaking_Listen_Repeat_Question4.mp3`,
    highlightCell: 'temperature',
  },
  {
    expectedText: 'Snacks can be found in the vending area throughout the event.',
    responseSeconds: 10,
    audioFile: `${AUDIO_BASE}/Speaking/Listen and Repeat/Speaking_Listen_Repeat_Question5.mp3`,
    highlightCell: 'wind',
  },
  {
    expectedText: 'Please see the information desk if you need an agenda.',
    responseSeconds: 12,
    audioFile: `${AUDIO_BASE}/Speaking/Listen and Repeat/Speaking_Listen_Repeat_Question6.mp3`,
    highlightCell: 'outlook',
  },
  {
    expectedText: 'If you want to check session times and locations, please use the schedule provided.',
    responseSeconds: 12,
    audioFile: `${AUDIO_BASE}/Speaking/Listen and Repeat/Speaking_Listen_Repeat_Question7.mp3`,
    highlightCell: 'morning',
  },
];

export const INTERVIEW_INTRO = {
  instructions:
    'An interviewer will ask you questions. Answer the questions and be sure to say as much as you can in the time allowed. No time for preparation will be provided.',
  scenario:
    'You have volunteered for a research study about work-life balance. You will have a short online interview with a researcher. The researcher will ask you some questions.',
  directionsAudio: `${AUDIO_BASE}/Speaking/Interview/Speaking_Interview_Directions.mp3`,
};

export interface InterviewItemData {
  questionText: string;
  responseSeconds: number;
  audioFile: string;
}

export const INTERVIEW: InterviewItemData[] = [
  {
    questionText:
      "Thank you for participating. Today, I'd like to ask you some questions about your work-life balance. First, can you share one or two strategies that you use that you think are effective in managing your work-life balance?",
    responseSeconds: 45,
    audioFile: `${AUDIO_BASE}/Speaking/Interview/Speaking_Interview_Question1.mp3`,
  },
  {
    questionText:
      'I see. Many companies are now developing programs to help employees manage work-life balance. Would programs like this affect your interest in working for a particular company? Why or why not?',
    responseSeconds: 45,
    audioFile: `${AUDIO_BASE}/Speaking/Interview/Speaking_Interview_Question2.mp3`,
  },
  {
    questionText:
      'Interesting. Some companies also offer flexible working hours or remote work options to help employees achieve a better work-life balance, but they are concerned that these options would reduce employee attention to tasks or engagement in the workplace. Do you think such programs are a good strategy for companies? Why or why not?',
    responseSeconds: 45,
    audioFile: `${AUDIO_BASE}/Speaking/Interview/Speaking_Interview_Question3.mp3`,
  },
  {
    questionText:
      "Good points. Lastly, looking to the future, do you think people's attitudes towards work-life balance will change? For example, do you think people will prioritize personal life over work, or work over personal life? Explain your thoughts.",
    responseSeconds: 45,
    audioFile: `${AUDIO_BASE}/Speaking/Interview/Speaking_Interview_Question4.mp3`,
  },
];

