// בועת הצ'אט: כפתור עגול בפינה שפותח חלון שיחה עם העוזר של BabyLink.
// העוזר הוא שירות Python נפרד (BabyLinkRAG) - פונים אליו ישירות, בלי שרת ה-.NET ובלי JWT,
// כי גם מי שלא מחובר צריך לשאול ("איך נרשמים?"). השיחה נשמרת רק בזיכרון הדף.
import { FileText, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import './ChatWidget.css'

const CHAT_URL = (import.meta.env.VITE_CHAT_URL ?? '').replace(/\/+$/, '')

// כמו בשרת: שאלה עד 500 תווים, ונשלחות רק ההודעות האחרונות כהיסטוריה
const MAX_QUESTION_LENGTH = 500
const MAX_HISTORY_MESSAGES = 6

// הטקסט בשדה ההקלדה. כל עוד לא עומדים על השדה - הוא "נכתב" ונמחק שוב ושוב
const PLACEHOLDER = 'כתבו שאלה...'

// שאלות לדוגמה שמופיעות בפתיחת שיחה חדשה
const SUGGESTIONS = ['איך מפרסמים בקשה?', 'איך מבטלים שיבוץ?', 'אילו פרטים שלי רואים אחרים?']

// שמות ידידותיים לקובצי המקור שהשרת מחזיר
const SOURCE_TITLES: Record<string, string> = {
  '01_about_babylink.md': 'אודות BabyLink',
  '02_parents_guide.md': 'מדריך להורים',
  '03_babysitters_guide.md': 'מדריך לשמרטפיות',
  '04_rules_and_policies.md': 'כללים ומדיניות',
  '05_faq.md': 'שאלות נפוצות',
  '06_contact_and_support.md': 'תמיכה',
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  isError?: boolean
}

interface ChatResponse {
  answer: string
  sources: string[]
}

// שליחת שאלה לשרת הצ'אט: { question, history } -> { answer, sources }
async function askChat(question: string, history: ChatMessage[]): Promise<ChatResponse> {
  const response = await fetch(`${CHAT_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      // לשרת שולחים רק תפקיד ותוכן, בלי מקורות ובלי הודעות שגיאה
      history: history
        .filter((m) => !m.isError)
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  })
  if (!response.ok) throw new Error(`Chat error ${response.status}`)
  return response.json()
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [typedPlaceholder, setTypedPlaceholder] = useState('')
  // "צריכים עזרה?" - יוצא מהכפתור פעם אחת ודועך אחרי כמה שניות (או כשפותחים את הצ'אט)
  const [showTeaser, setShowTeaser] = useState(false)
  // מספר השיחה. "שיחה חדשה" מעלה אותו, ותשובה שמגיעה לשיחה ישנה נזרקת
  const conversationId = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowTeaser(true), 1500)
    return () => window.clearTimeout(timer)
  }, [])

  // גלילה לתחתית בכל הודעה חדשה (ובזמן "מקלידה...")
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // אפקט "מכונת כתיבה" ב-placeholder: אות אחרי אות, הפסקה, מחיקה, וחוזר חלילה.
  // רץ רק כשהחלון פתוח ולא עומדים על השדה
  useEffect(() => {
    if (!open || inputFocused) return
    let length = 0
    let deleting = false
    let timer: number

    function tick() {
      length += deleting ? -1 : 1
      setTypedPlaceholder(PLACEHOLDER.slice(0, length))

      let delay = deleting ? 45 : 90 // מחיקה מהירה יותר מכתיבה
      if (length === PLACEHOLDER.length) {
        deleting = true
        delay = 1400 // המשפט המלא נשאר רגע על המסך
      } else if (length === 0) {
        deleting = false
        delay = 500
      }
      timer = window.setTimeout(tick, delay)
    }

    timer = window.setTimeout(tick, 300)
    return () => window.clearTimeout(timer)
  }, [open, inputFocused])

  // סגירה ב-Esc
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  function toggle() {
    setOpen((o) => !o)
    setShowTeaser(false)
  }

  async function send(text: string) {
    const question = text.trim()
    if (!question || sending) return

    const history = messages
    const myConversation = conversationId.current
    setMessages([...history, { role: 'user', content: question }])
    setInput('')
    setSending(true)

    let reply: ChatMessage
    try {
      const data = await askChat(question, history)
      reply = { role: 'assistant', content: data.answer, sources: data.sources }
    } catch {
      reply = {
        role: 'assistant',
        content: 'העוזר לא זמין כרגע. נסו שוב בעוד רגע.',
        isError: true,
      }
    }

    // אם בינתיים התחילו שיחה חדשה - התשובה כבר לא רלוונטית
    if (myConversation !== conversationId.current) return
    setMessages((prev) => [...prev, reply])
    setSending(false)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send(input)
  }

  function newConversation() {
    conversationId.current++
    setMessages([])
    setInput('')
    setSending(false)
    inputRef.current?.focus()
  }

  return (
    <div className={`chat ${open ? 'is-open' : ''}`}>
      {open && (
        <section className="chat-panel" role="dialog" aria-label="העוזר של BabyLink">
          <header className="chat-head">
            <span className="chat-avatar">
              <Sparkles size={20} />
            </span>
            <div className="chat-head-text">
              <strong>העוזר של BabyLink</strong>
              <span className="chat-status">עונה לשאלות על האתר</span>
            </div>
            <button
              type="button"
              className="chat-icon-btn"
              onClick={newConversation}
              disabled={messages.length === 0}
              aria-label="שיחה חדשה"
              title="שיחה חדשה"
            >
              <RotateCcw size={18} />
            </button>
            <button type="button" className="chat-icon-btn" onClick={toggle} aria-label="סגירת הצ'אט" title="סגירה">
              <X size={20} />
            </button>
          </header>

          <div className="chat-messages" ref={listRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <div className="chat-welcome-icon">
                  <MessageCircle size={28} />
                </div>
                <h3>היי! 👋</h3>
                <p>אני העוזר של BabyLink. אפשר לשאול אותי איך משתמשים באתר, על הכללים ועל התמיכה.</p>
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      className="chat-chip"
                      style={{ animationDelay: `${0.15 + i * 0.08}s` }}
                      onClick={() => send(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg-${m.role} ${m.isError ? 'is-error' : ''}`}>
                <div className="chat-bubble">{m.content}</div>
                {m.sources && m.sources.length > 0 && (
                  <div className="chat-sources">
                    <span>מקורות:</span>
                    {m.sources.map((s) => (
                      <span key={s} className="chat-source">
                        <FileText size={12} />
                        {SOURCE_TITLES[s] ?? s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="chat-msg chat-msg-assistant">
                <div className="chat-bubble chat-typing" aria-label="מקלידה...">
                  <span className="chat-dot" />
                  <span className="chat-dot" />
                  <span className="chat-dot" />
                  <span className="chat-typing-text">מקלידה...</span>
                </div>
              </div>
            )}
          </div>

          <form className="chat-form" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              // עומדים על השדה - הטקסט המלא בלי אנימציה. אחרת - הטקסט שנכתב עכשיו, עם "סמן" בסופו
              placeholder={inputFocused ? PLACEHOLDER : `${typedPlaceholder}|`}
              maxLength={MAX_QUESTION_LENGTH}
              aria-label="שאלה לעוזר"
            />
            <button type="submit" className="chat-send" disabled={!input.trim() || sending} aria-label="שליחה">
              <Send size={18} />
            </button>
          </form>
        </section>
      )}

      {showTeaser && !open && (
        <button
          type="button"
          className="chat-teaser"
          onClick={toggle}
          // כשאנימציית הדעיכה מסתיימת - מסירים אותו מהדף
          onAnimationEnd={() => setShowTeaser(false)}
        >
          צריכים עזרה? 👋
        </button>
      )}

      <button
        type="button"
        className="chat-launcher"
        onClick={toggle}
        aria-label={open ? "סגירת הצ'אט" : "פתיחת הצ'אט עם העוזר"}
        aria-expanded={open}
      >
        <span className="chat-launcher-icon">{open ? <X size={26} /> : <MessageCircle size={26} />}</span>
      </button>
    </div>
  )
}
