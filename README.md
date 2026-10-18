# BabyLink Client – לקוח React

לקוח React שמדגים את [BabyLink API](https://github.com/BrachaBeker/BabyLinkAPI): Web API ב-.NET 10 לתיווך בין הורים לשמרטפיות. הורה מפרסם בקשת שמרטפות, שמרטפיות רואות ומסננות את הבקשות, ו**הראשונה שתופסת בקשה זוכה בה**. השנייה מקבלת **409 Conflict**, והלקוח מציג לה את זה בצורה ברורה.

> 🔗 לקוח: https://babylinkclient.onrender.com · שרת: https://babylink-api.onrender.com · Swagger: https://babylink-api.onrender.com/swagger · Repository השרת: https://github.com/BrachaBeker/BabyLinkAPI

---

## המסכים

| # | מסך | נתיב | מה יש בו |
|---|---|---|---|
| 1 | התחברות והרשמה | `/login` | התחברות, הרשמה עם בחירת תפקיד (הורה / שמרטפית), שגיאות מהשרת ליד כל שדה, כפתורי מילוי מהיר למשתמשי הדמו |
| 2 | רשימת בקשות | `/requests` | כרטיסים עם מועד (בשעון מקומי), כתובת, ילדים, תעריף, תגיות וסטטוס. סינון (עיר, רחוב, תגית, תעריף מינימלי, רק פנויות, שלי), מיון (מועד / תעריף, עולה / יורד) ו-Pagination |
| 3 | פרטי בקשה | `/requests/:id` | כל הפרטים, ההורה והשמרטפית שתפסה. שמרטפית: **"אני לוקחת"**. ההורה שפרסם: עריכה ומחיקה |
| 4 | טופס בקשה (הורה) | `/requests/new`, `/requests/:id/edit` | אותו טופס ליצירה (POST) ולעריכה (PUT) |

## תרחיש ה-409 (הלב של הפרויקט)

1. פותחים שני דפדפנים (או חלון רגיל + חלון גלישה בסתר).
2. בראשון מתחברים כ-`sitter1@babylink.dev`, בשני כ-`sitter2@babylink.dev`.
3. בשניהם נכנסים לאותה בקשה **פנויה**.
4. בראשון לוחצים **"אני לוקחת"** ← הודעת הצלחה ירוקה, והסטטוס מתחלף ל"נתפסה".
5. בשני (המסך עדיין מראה "פנויה") לוחצים **"אני לוקחת"** ← השרת מחזיר **409**, ומופיעה הודעה אדומה ובולטת: *"הבקשה כבר נתפסה על ידי שמרטפית אחרת."* מיד אחר כך הלקוח **טוען מחדש את הבקשה מהשרת**, והמסך מראה "נתפסה" ואת שם השמרטפית שתפסה.

## טכנולוגיות והחלטות

- **React 19 + Vite + TypeScript**, ניווט עם `react-router-dom`.
- **בלי ספריית UI:** מערכת עיצוב קטנה ב-CSS רגיל (משתנים ב-`src/index.css` וקובץ CSS לכל מסך). אייקונים מ-`lucide-react`, גופן Heebo.
- **עברית ו-RTL** (`<html lang="he" dir="rtl">`).
- **שכבת API אחת** (`src/api`): כל קריאה עוברת דרך `apiRequest`, שמוסיפה את כתובת השרת, את ה-JWT ואת ה-headers, ומתרגמת כל שגיאה (ProblemDetails) ל-`ApiError` אחיד.
- **JWT:** אחרי ההתחברות ה-token נשמר ב-`localStorage`, ונשלח בכל בקשה כ-`Authorization: Bearer <token>`. כשהשרת מחזיר **401** הלקוח מוחק את ה-token ומעביר למסך ההתחברות.
- **הרשאות נאכפות בשרת:** הלקוח משתמש בתפקיד רק כדי להחליט מה להציג (למשל להסתיר את "בקשה חדשה" משמרטפית). גם אם מישהו "יעקוף" את הלקוח, השרת יחזיר 403.
- **זמנים:** השרת עובד ב-UTC. בשליחה ממירים זמן מקומי ל-UTC (`new Date(local).toISOString()`), ובהצגה ממירים חזרה לשעון המקומי.
- **שרת שנרדם:** השרת החינמי ב-Render נרדם אחרי זמן ללא שימוש, והבקשה הראשונה לוקחת עד כדקה. כל בקשה מציגה מצב טעינה, ואחרי כמה שניות מופיע הסבר שהשרת "מתעורר".
- **ולידציה:** הטפסים בודקים מראש את הכללים הבסיסיים (שדות חובה, סיום אחרי התחלה, התחלה בעתיד, עד 24 שעות) לנוחות המשתמש. השרת בודק שוב והוא הקובע. הודעות הוולידציה האוטומטיות של ASP.NET חוזרות באנגלית, ולכן הלקוח מתרגם את התבניות המוכרות לעברית.
- **הסינון נשמר ב-URL** (למשל `/requests?city=ירושלים&available=1&page=2`), כך שרענון או חזרה ממסך הפרטים שומרים על אותו מצב.

## הרצה מקומית

דרישות: Node.js 20 ומעלה, והשרת רץ מקומית על `http://localhost:5083` (ראו ה-README של השרת).

```bash
npm install
cp .env.example .env    # ב-PowerShell: Copy-Item .env.example .env
npm run dev             # http://localhost:5173
```

> השרת מאפשר CORS ל-`http://localhost:5173` (פורט ברירת המחדל של Vite), לכן לא משנים את הפורט.

פקודות נוספות: `npm run build` (בנייה ל-`dist`), `npm run preview` (הרצת ה-build).

## משתני סביבה

| משתנה | תיאור | מקומי | Render |
|---|---|---|---|
| `VITE_API_URL` | כתובת השרת, בלי `/` בסוף | `http://localhost:5083` | `https://babylink-api.onrender.com` |

ה-repository כולל רק את `.env.example`. הקובץ `.env` לא נכנס ל-Git.

## משתמשי דמו

הסיסמה לכולם: `Demo123!`

| אימייל | תפקיד |
|---|---|
| `parent1@babylink.dev` | הורה |
| `parent2@babylink.dev` | הורה |
| `sitter1@babylink.dev` | שמרטפית |
| `sitter2@babylink.dev` | שמרטפית |

## פריסה ב-Render (Static Site)

1. **New ← Static Site**, ובוחרים את ה-repository `BabyLinkClient`.
2. **Build Command:** `npm install && npm run build`
3. **Publish Directory:** `dist`
4. **Environment:** `VITE_API_URL=https://babylink-api.onrender.com`
5. **Redirects/Rewrites:** Source `/*` ← Destination `/index.html`, Action **Rewrite**. בלי זה, רענון בעמוד פנימי (למשל `/requests/5`) יחזיר 404.
6. **בשרת** (ה-Web Service `babylink-api`) מוסיפים משתנה סביבה `Cors__AllowedOrigins__0` עם הכתובת של ה-Static Site, בלי `/` בסוף, ועושים Deploy מחדש לשרת.

## מבנה הפרויקט

```
src/
├── api/            # client.ts (apiRequest + ApiError), babylink.ts (ה-endpoints), types.ts (חוזה ה-API)
├── auth/           # AuthContext (token, משתמש, login/logout), ProtectedRoute
├── components/     # Layout, Alert, Loading, FormField, StatusBadge, Pagination, ConfirmDialog, EmptyState
├── hooks/          # useTags
├── pages/
│   ├── auth/       # מסך 1: התחברות והרשמה
│   ├── requests/   # מסך 2: רשימת בקשות
│   ├── details/    # מסך 3: פרטי בקשה ותפיסה
│   └── form/       # מסך 4: טופס יצירה ועריכה
└── utils/          # format.ts (תאריכים, מטבע, המרות UTC)
```
