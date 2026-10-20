import {AIError} from './ai-budget';

/** Opt-in stays server-side; an old browser preference cannot authorize spending. */
export function paidAIEnabled(){return process.env.AI_ENABLED==='true';}
export function assertPaidAIAllowed(): void {
 if(!paidAIEnabled())throw new AIError(403,'Paid AI is disabled. Use the local simulation; no provider request was sent.');
}
