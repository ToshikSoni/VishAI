/**
 * Mental Health Knowledge Base
 * Evidence-based information on mental health conditions
 */

export const mentalHealthKnowledgeBase = {
  anxiety: {
    description: 'Anxiety disorders involve excessive fear or worry that interferes with daily activities.',
    symptoms: ['Excessive worry', 'Restlessness', 'Rapid heartbeat', 'Difficulty concentrating', 
               'Sleep disturbances', 'Muscle tension', 'Panic attacks'],
    types: ['Generalized Anxiety Disorder (GAD)', 'Social Anxiety Disorder', 'Panic Disorder', 
            'Specific Phobias'],
    treatments: ['Cognitive Behavioral Therapy (CBT)', 'Exposure therapy', 'Mindfulness techniques',
                'Medication (SSRIs, SNRIs)', 'Lifestyle modifications'],
    selfHelp: ['Practice deep breathing', 'Regular exercise', 'Limit caffeine', 
               'Maintain sleep schedule', 'Challenge anxious thoughts']
  },

  depression: {
    description: 'Major depressive disorder characterized by persistent sadness and loss of interest.',
    symptoms: ['Persistent sad mood', 'Loss of interest', 'Changes in appetite', 'Sleep issues',
               'Fatigue', 'Feelings of worthlessness', 'Difficulty concentrating', 'Thoughts of death'],
    types: ['Major Depressive Disorder', 'Persistent Depressive Disorder', 'Seasonal Affective Disorder',
            'Postpartum Depression'],
    treatments: ['CBT', 'Interpersonal Therapy', 'Behavioral Activation', 'Antidepressants',
                'Light therapy for SAD'],
    selfHelp: ['Maintain routine', 'Exercise regularly', 'Connect with others', 
               'Set small goals', 'Practice self-compassion']
  },

  stress: {
    description: 'Chronic stress from prolonged exposure to stressors that overwhelm coping abilities.',
    symptoms: ['Irritability', 'Feeling overwhelmed', 'Racing thoughts', 'Difficulty relaxing',
               'Low energy', 'Headaches', 'Digestive issues'],
    treatments: ['Stress management therapy', 'Mindfulness-Based Stress Reduction', 
                'Time management skills', 'Relaxation training'],
    selfHelp: ['Identify stressors', 'Practice time management', 'Set boundaries',
               'Use relaxation techniques', 'Maintain work-life balance']
  },

  panic: {
    description: 'Sudden episodes of intense fear with physical symptoms.',
    symptoms: ['Racing heart', 'Sweating', 'Trembling', 'Shortness of breath',
               'Chest pain', 'Dizziness', 'Fear of losing control'],
    treatments: ['CBT', 'Panic-focused therapy', 'Breathing retraining', 'Medication'],
    selfHelp: ['4-7-8 breathing', 'Grounding techniques (5-4-3-2-1)',
               'Challenge catastrophic thoughts', 'Gradual exposure']
  }
};
