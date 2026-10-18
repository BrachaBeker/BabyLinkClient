// העברת פרטי בקשה קיימת לטופס "בקשה חדשה" - ב"ביטול ופרסום מחדש" וב"פרסום שוב" מההיסטוריה.
// הפרטים עוברים ב-state של הניווט (בלי URL ארוך), והטופס ממלא את עצמו מהם.
import type { ServiceRequestBody, ServiceRequestDetails } from '../../api/types'

export interface RepostState {
  repost: ServiceRequestBody
  // הסבר קצר שמוצג בראש הטופס
  repostNotice: string
}

export function toRepost(request: ServiceRequestDetails): ServiceRequestBody {
  return {
    startTimeUtc: request.startTimeUtc,
    endTimeUtc: request.endTimeUtc,
    city: request.city,
    street: request.street,
    houseNumber: request.houseNumber,
    addressNotes: request.addressNotes,
    childrenCount: request.childrenCount,
    hourlyRate: request.hourlyRate,
    description: request.description,
    tagIds: request.tags.map((tag) => tag.id),
  }
}
