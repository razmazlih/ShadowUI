import type {UIComponent} from './schema';

export const LEARNING_CONTENT_POLICY='Learning content: explanations, a worked example, and answerable practice with feedback; general material must be labeled provisional when no syllabus is supplied.';
export const RESPONSE_QUALITY_RULES=`Deliver useful work, not descriptions of work the user should do. Every suggested step must say what to do, with concrete task-specific inputs and a checkable result. "Understand the basics" and "practice examples" alone are not usable deliverables. For learning and exam preparation, provide a sequenced path, actual explanations of core concepts, at least one worked example showing reasoning, and concrete practice questions with correct answers and explanatory feedback. Use notes for explanations and worked solutions, quiz for answerable practice (answer exactly matches an option; detail explains the reasoning), and checklist for specific exercises with completion criteria. A timeline is navigation, not the learning content itself. General established subject knowledge and original illustrative exercises are allowed without uploaded material; label them a provisional general starting point and invite syllabus alignment without blocking useful work. Do not invent course-specific coverage or exam questions. Avoid empty date fields and made-up deadlines; use ordered stages when dates are unknown. For example, probability practice should include actual events, sample spaces or numerical probabilities to calculate and explain, not merely an instruction to practice probability. Preserve user edits on follow-ups.`;

export function isLearningRequest(intent:string){
 return /\b(?:learn\s+(?!cards\b)|learning\s+(?:plan|path|roadmap)|study\s+(?!cards\b|flashcards\b|quiz\b)\S+|studying\s+\S+|curriculum|exam preparation|prepare for (?:an? |the )?exam)|ללמוד|למידה|לימוד|הכנה למבחן|להתכונן למבחן/iu.test(intent);
}

/** Structural quality checks complement capability coverage; they do not certify factual accuracy. */
export function learningContentProblems(components:UIComponent[]){
 const problems:string[]=[];
 const explanation=components.some(c=>c.type==='notes'&&!!c.text?.trim());
 const practice=components.some(c=>c.type==='quiz'&&c.items.length>=2&&c.items.every(i=>!!i.answer?.trim()&&!!i.detail?.trim()&&!!i.options&&i.options.length>=2&&i.options.includes(i.answer)));
 if(!explanation)problems.push('Learning needs supporting notes containing concept explanations and a worked example with reasoning, not only a list of topics');
 if(!practice)problems.push('Learning needs at least two concrete quiz questions, each with choices, a matching correct answer and explanatory feedback in detail');
 return problems;
}
