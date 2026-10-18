import type { UIComponent, Item } from './schema';

/** Curated entry points and encoded searches; never pretend these are live results. */
export function relevantLinks(prompt: string): UIComponent | undefined {
 const he = /[\u0590-\u05ff]/.test(prompt);
 const items: Item[] = [];
 const add = (id:string, label:string, url:string, en:string, hebrew:string) => items.push({id,label,url,detail:he?hebrew:en});
 const query = encodeURIComponent(prompt);
 if (/trip|travel|flight|fly|japan|itinerary|טיול|טיס|לטוס|תעופה|חופשה/i.test(prompt)) {
  add('google-flights','Google Flights','https://www.google.com/travel/flights','Compare flight dates and fares','השוואת טיסות, תאריכים ומחירים');
  add('skyscanner','Skyscanner','https://www.skyscanner.net/','Explore destinations and flight options','חיפוש יעדים והשוואת אפשרויות טיסה');
  add('kayak','KAYAK','https://www.kayak.com/flights','Compare routes and airlines','השוואת מסלולים וחברות תעופה');
 }
 if (/hotel|accommodation|trip|travel|מלון|מלונות|לינה|חופשה|טיול/i.test(prompt)) {
  add('booking','Booking.com','https://www.booking.com/','Find accommodation for your dates','חיפוש מקומות לינה לפי היעד והתאריכים');
 }
 if (/learn|study|course|exam|ללמוד|לימוד|קורס|מבחן/i.test(prompt)) {
  add('learning',he?'חיפוש חומרי לימוד':'Find learning resources',`https://www.google.com/search?q=${query}`,'Search for material matching your subject','חיפוש חומרי לימוד שמתאימים לנושא שלך');
 }
 if (/buy|shop|product|price|purchase|לקנות|קניות|מוצר|מחיר/i.test(prompt)) {
  add('shopping',he?'השוואת מוצרים ומחירים':'Compare products and prices',`https://www.google.com/search?tbm=shop&q=${query}`,'Search shopping results for your request','חיפוש מוצרים ומחירים בהתאם לבקשה');
 }
 if (/restaurant|cafe|nearby|מסעד|בית קפה|בקרבת|קרוב אלי/i.test(prompt)) {
  add('maps',he?'חיפוש במפות':'Search maps',`https://www.google.com/maps/search/?api=1&query=${query}`,'Find places, opening hours and directions','מציאת מקומות, שעות פתיחה ודרכי הגעה');
 }
 if (!items.length && /search|find|research|source|resource|link|website|חפש|חיפוש|מצא|למצוא|מקור|קישור|אתר|מחקר/i.test(prompt)) {
  add('search',he?'חיפוש מקורות רלוונטיים':'Find relevant sources',`https://www.google.com/search?q=${query}`,'Search the web for this request','חיפוש ברשת בהתאם לבקשה שלך');
 }
 if (!items.length) return;
 return {id:'links',type:'links',title:he?'קישורים שימושיים':'Useful links',reason:he?'קישורים שיעזרו להתקדם בבקשה שלך.':'External resources help move this goal forward.',span:'normal',items,text:he?'פתיחה בלשונית חדשה. אלו קישורי חיפוש ואתרים שימושיים; מחירים וזמינות לא נבדקו בזמן אמת.':'Opens in a new tab. These are useful sites and searches; prices and availability have not been checked live.'};
}
