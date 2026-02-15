/**
 * Evidence-Based Coping Strategies
 */

export const copingStrategies = {
  immediate: [
    {
      name: '4-7-8 Breathing',
      duration: '1 minute',
      steps: ['Exhale completely', 'Inhale through nose for 4 counts', 
              'Hold for 7 counts', 'Exhale through mouth for 8 counts', 'Repeat 3-4 times'],
      applicableTo: ['anxiety', 'panic', 'stress', 'anger'],
      effectiveness: 'High for acute anxiety'
    },
    {
      name: '5-4-3-2-1 Grounding',
      duration: '3 minutes',
      steps: ['Name 5 things you see', '4 things you can touch', 
              '3 things you hear', '2 things you smell', '1 thing you taste'],
      applicableTo: ['anxiety', 'panic', 'dissociation', 'trauma'],
      effectiveness: 'Excellent for panic attacks'
    },
    {
      name: 'Box Breathing',
      duration: '5 minutes',
      steps: ['Inhale for 4 counts', 'Hold for 4 counts', 
              'Exhale for 4 counts', 'Hold empty for 4 counts', 'Repeat'],
      applicableTo: ['anxiety', 'stress', 'anger'],
      effectiveness: 'Regulates nervous system'
    }
  ],
  
  'short-term': [
    {
      name: 'Progressive Muscle Relaxation',
      duration: '10-15 minutes',
      steps: ['Tense muscle group for 5 seconds', 'Release and notice difference',
              'Move through body: feet, legs, hands, arms, shoulders, face'],
      applicableTo: ['anxiety', 'stress', 'insomnia', 'tension'],
      effectiveness: 'High for physical tension'
    },
    {
      name: 'Journaling',
      duration: '15-20 minutes',
      steps: ['Write freely about feelings', 'No judgment or editing',
              'Focus on emotions and thoughts', 'Identify patterns'],
      applicableTo: ['depression', 'anxiety', 'stress', 'trauma'],
      effectiveness: 'Excellent for emotional processing'
    },
    {
      name: 'Physical Activity',
      duration: '20-30 minutes',
      steps: ['Choose activity you enjoy', 'Start with 10 minutes if needed',
              'Focus on movement, not perfection', 'Notice how you feel after'],
      applicableTo: ['depression', 'anxiety', 'stress', 'anger'],
      effectiveness: 'Very high - releases endorphins'
    }
  ],
  
  'long-term': [
    {
      name: 'Daily Mindfulness Practice',
      duration: '10-20 minutes daily',
      steps: ['Set consistent time', 'Start with 5 minutes', 
              'Focus on breath or body', 'Gradually increase duration'],
      applicableTo: ['anxiety', 'depression', 'stress', 'chronic pain'],
      effectiveness: 'Very high with consistent practice'
    },
    {
      name: 'Sleep Hygiene',
      duration: 'Ongoing',
      steps: ['Consistent sleep schedule', 'Dark, cool room',
              'No screens 1 hour before bed', 'Relaxing bedtime routine'],
      applicableTo: ['insomnia', 'depression', 'anxiety', 'stress'],
      effectiveness: 'Essential foundation for mental health'
    },
    {
      name: 'Social Connection',
      duration: 'Regular engagement',
      steps: ['Schedule regular contact', 'Join groups with shared interests',
              'Volunteer opportunities', 'Be vulnerable with trusted people'],
      applicableTo: ['depression', 'loneliness', 'anxiety', 'isolation'],
      effectiveness: 'Critical for wellbeing'
    }
  ]
};
