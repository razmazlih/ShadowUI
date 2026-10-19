const trialEndsAt = Date.parse('2026-10-19T20:06:20Z');

export type AIModelConfig = {
 model: string;
 inputUSDPerToken: number;
 outputUSDPerToken: number;
 temperature?: number;
};

const baseline: AIModelConfig = {
 model: 'gpt-4.1-mini',
 inputUSDPerToken: 0.40 / 1e6,
 outputUSDPerToken: 1.60 / 1e6,
 temperature: 0.3,
};

const trial: AIModelConfig = {
 model: 'gpt-6.1-sol',
 inputUSDPerToken: 2.00 / 1e6,
 outputUSDPerToken: 10.00 / 1e6,
};

export function activeAIModel(now = Date.now()): AIModelConfig {
 return now < trialEndsAt ? trial : baseline;
}

export const AI_MODEL_TRIAL_ENDS_AT = trialEndsAt;
