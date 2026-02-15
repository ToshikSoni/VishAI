/**
 * Crisis Resources & Emergency Hotlines
 */

export const crisisResources = {
  US: {
    suicide: {
      name: '988 Suicide & Crisis Lifeline',
      number: '988',
      alternativeNumber: '1-800-273-8255',
      textLine: 'Text "HELLO" to 741741',
      website: 'https://988lifeline.org',
      description: '24/7 free and confidential support',
      languages: ['English', 'Spanish', 'Translations available']
    },
    emergency: {
      number: '911',
      note: 'For immediate life-threatening emergencies'
    },
    veterans: {
      name: 'Veterans Crisis Line',
      number: '988, then press 1',
      textLine: 'Text 838255'
    },
    lgbtq: {
      name: 'The Trevor Project',
      number: '1-866-488-7386',
      textLine: 'Text "START" to 678-678'
    }
  },
  
  UK: {
    suicide: {
      name: 'Samaritans',
      number: '116 123',
      email: 'jo@samaritans.org',
      description: '24/7 confidential support'
    },
    emergency: {
      number: '999 or 112'
    }
  },
  
  CA: {
    suicide: {
      name: 'Canada Suicide Prevention Service',
      number: '1-833-456-4566',
      textLine: 'Text 45645'
    },
    emergency: {
      number: '911'
    }
  }
};

export const crisisProtocol = {
  severe: {
    level: 'SEVERE - Immediate danger',
    indicators: ['Active suicidal ideation with plan', 'Intent to harm', 'Recent attempt'],
    actions: ['Provide emergency hotline immediately', 'Encourage calling 911', 
              'Stay engaged until help contacted', 'Express care and concern']
  },
  moderate: {
    level: 'MODERATE - Heightened risk',
    indicators: ['Passive suicidal ideation', 'Self-harm thoughts', 'Severe hopelessness'],
    actions: ['Provide crisis hotline', 'Encourage trusted person contact',
              'Explore safety planning', 'Validate feelings']
  },
  low: {
    level: 'LOW - Standard support',
    indicators: ['General distress', 'Anxiety/depression symptoms', 'Life stressors'],
    actions: ['Provide empathetic support', 'Teach coping skills',
              'Encourage professional help', 'Build on strengths']
  }
};
