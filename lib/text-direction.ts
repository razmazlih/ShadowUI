/** Resolve layout from the first strong letter, ignoring numbers and punctuation. */
export function textDirection(text:string,fallback:'rtl'|'ltr'='ltr'):'rtl'|'ltr'{
 for(const character of text){
  if(!/\p{Letter}/u.test(character))continue;
  return /[\p{Script=Hebrew}\p{Script=Arabic}]/u.test(character)?'rtl':'ltr';
 }
 return fallback;
}
