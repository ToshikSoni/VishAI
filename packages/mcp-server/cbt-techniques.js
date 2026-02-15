/**
 * Cognitive Behavioral Therapy Techniques
 */

export const cbtTechniques = {
  'thought-challenging': {
    name: 'Thought Challenging (Cognitive Restructuring)',
    description: 'Identify and challenge negative automatic thoughts',
    steps: [
      {
        step: 1,
        title: 'Identify the Thought',
        instruction: 'What is the negative thought? Write it down exactly as it appears.',
        example: '"I\'m a complete failure at everything"'
      },
      {
        step: 2,
        title: 'Identify the Emotion',
        instruction: 'What emotion does this thought create? Rate intensity 0-10.',
        example: 'Sadness (8/10), Hopelessness (9/10)'
      },
      {
        step: 3,
        title: 'Examine the Evidence',
        instruction: 'What evidence supports this thought? What evidence contradicts it?',
        example: 'Against: I completed project last week, friend thanked me for support'
      },
      {
        step: 4,
        title: 'Alternative Thought',
        instruction: 'Create a more balanced, realistic thought.',
        example: '"I struggle in some areas but succeed in others, like everyone"'
      },
      {
        step: 5,
        title: 'Re-rate Emotion',
        instruction: 'How intense is the emotion now? 0-10',
        example: 'Sadness (4/10), Hopelessness (3/10)'
      }
    ],
    bestFor: ['Depression', 'Anxiety', 'Low self-esteem'],
    difficulty: 'Moderate'
  },

  'behavioral-activation': {
    name: 'Behavioral Activation',
    description: 'Schedule activities that bring pleasure or accomplishment to combat depression',
    steps: [
      {
        step: 1,
        title: 'Activity Inventory',
        instruction: 'List activities you used to enjoy or that might bring satisfaction',
        example: 'Walking, calling friend, cooking, reading'
      },
      {
        step: 2,
        title: 'Rate Difficulty',
        instruction: 'Rate each activity difficulty (1=very easy, 10=very hard)',
        example: 'Get coffee: 3, Call friend: 5, Go to gym: 8'
      },
      {
        step: 3,
        title: 'Start Small',
        instruction: 'Choose 1-2 easy activities (difficulty 1-4) for today',
        example: 'Make tea and sit outside for 5 minutes'
      },
      {
        step: 4,
        title: 'Schedule It',
        instruction: 'Pick specific time and duration. Write it down.',
        example: 'Today at 2 PM for 10 minutes'
      },
      {
        step: 5,
        title: 'Do It & Track',
        instruction: 'Complete activity. Rate mood before/after (0-10)',
        example: 'Before: 3/10, After: 5/10'
      },
      {
        step: 6,
        title: 'Build Gradually',
        instruction: 'Add more activities as you build momentum',
        example: 'Week 2: Add moderate difficulty activities'
      }
    ],
    bestFor: ['Depression', 'Lack of motivation', 'Anhedonia'],
    difficulty: 'Easy to Moderate'
  },

  'problem-solving': {
    name: 'Structured Problem Solving',
    description: 'Break down overwhelming problems into manageable steps',
    steps: [
      {
        step: 1,
        title: 'Define the Problem',
        instruction: 'Clearly state the problem in one sentence. Be specific.',
        example: '"I feel overwhelmed by unpaid bills"'
      },
      {
        step: 2,
        title: 'Brainstorm Solutions',
        instruction: 'List all possible solutions, even imperfect ones. No judgment yet.',
        example: 'Call creditors, payment plan, ask family help, sell items, get extra work'
      },
      {
        step: 3,
        title: 'Evaluate Options',
        instruction: 'For each solution: List pros, cons, feasibility (1-10)',
        example: 'Payment plan: Pro-manageable, Con-takes time, Feasibility: 8/10'
      },
      {
        step: 4,
        title: 'Choose Best Option',
        instruction: 'Select the most feasible solution with best pros/cons balance',
        example: 'Call creditors to set up payment plan'
      },
      {
        step: 5,
        title: 'Make Action Plan',
        instruction: 'Break solution into small, concrete steps with timeline',
        example: 'Monday: Gather bills. Tuesday: Call first creditor.'
      },
      {
        step: 6,
        title: 'Implement & Review',
        instruction: 'Take action. Review after 1 week. Adjust if needed.',
        example: 'If didn\'t work, try next solution from list'
      }
    ],
    bestFor: ['Stress', 'Feeling overwhelmed', 'Anxiety about specific situation'],
    difficulty: 'Moderate'
  },

  'exposure-therapy': {
    name: 'Gradual Exposure',
    description: 'Face fears gradually in a controlled way to reduce anxiety',
    steps: [
      {
        step: 1,
        title: 'Create Fear Hierarchy',
        instruction: 'List situations you avoid. Rate anxiety level for each (0-100)',
        example: '20: Think about dog, 40: See dog picture, 60: See dog across street, 100: Pet dog'
      },
      {
        step: 2,
        title: 'Start at Bottom',
        instruction: 'Begin with lowest anxiety situation (20-30 level)',
        example: 'Look at dog pictures for 5 minutes'
      },
      {
        step: 3,
        title: 'Stay Until Anxiety Drops',
        instruction: 'Remain in situation until anxiety decreases by half. This is crucial.',
        example: 'Anxiety starts at 40, stay until it drops to 20 or below'
      },
      {
        step: 4,
        title: 'Repeat Exposure',
        instruction: 'Practice same level multiple times until anxiety is minimal',
        example: 'Look at dog pictures daily until anxiety is 10 or less'
      },
      {
        step: 5,
        title: 'Move Up Hierarchy',
        instruction: 'Once comfortable, move to next level',
        example: 'Next: Watch dogs at park from safe distance'
      }
    ],
    bestFor: ['Phobias', 'Social anxiety', 'PTSD', 'OCD'],
    difficulty: 'Challenging - consider with therapist guidance',
    warning: 'For severe fears or trauma, work with trained therapist'
  }
};
