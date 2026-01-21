export const loadGoogleScript = () => {
    return new Promise<void>((resolve, reject) => {
        if ((window as any).google?.accounts) {
            resolve();
            return;
        }
        // Check if script is already loading
        if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
            // Ideally we should wait for it, but for simplicity let's just assume it will load or user retries.
            // Better: attach onload handler to existing script if possible, or just wait a bit.
            // For now, let's just append again or rely on the previous one. 
            // Actually, multiple appends might be bad.
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = reject;
        document.body.appendChild(script);
    });
};

export interface GoogleEvent {
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    htmlLink?: string;
}

export interface GoogleCalendar {
    id: string;
    summary: string;
    primary?: boolean;
    backgroundColor?: string;
}

export const fetchCalendarList = async (accessToken: string): Promise<GoogleCalendar[]> => {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch calendar list');
    }

    const data = await response.json();
    return data.items || [];
};

export const fetchGoogleEvents = async (accessToken: string, calendarId: string, timeMin: string, timeMax: string): Promise<GoogleEvent[]> => {
    // Ensure dates are ISO strings
    const start = new Date(timeMin).toISOString();
    const end = new Date(timeMax);

    const params = new URLSearchParams({
        timeMin: start,
        timeMax: end.toISOString(),
        singleEvents: 'true', // Expand recurring events
        orderBy: 'startTime',
        maxResults: '2500' // Limit
    });

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch calendar events');
    }

    return data.items || [];
};

export const updateGoogleEvent = async (accessToken: string, calendarId: string, eventId: string, eventData: any): Promise<void> => {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData),
        });

        if (response.ok) return;

        // Handle Rate Limit (403: User Rate Limit Exceeded, 429: Too Many Requests)
        if (response.status === 403 || response.status === 429) {
            const errBody = await response.clone().json().catch(() => ({}));
            const msg = (errBody.error?.message || '').toLowerCase();

            // Check if it's a rate limit issue
            if (msg.includes('rate limit') || msg.includes('quota') || response.status === 429) {
                if (attempt < maxRetries) {
                    const delay = attempt * 1500; // Exponential-ish backoff: 1.5s, 3s
                    console.warn(`[Google Sync] Rate Limit Hit. Retrying update in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
            }
        }

        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to update Google event');
    }
};

export const deleteGoogleEvent = async (accessToken: string, calendarId: string, eventId: string): Promise<void> => {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to delete Google event');
    }
};

// Create a new Google Calendar event
export const createGoogleEvent = async (accessToken: string, calendarId: string, eventData: any): Promise<string> => {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to create Google event');
    }

    const data = await response.json();
    return data.id; // Return new event ID
};

// Fetch incremental updates
export const fetchUpdatedGoogleEvents = async (accessToken: string, calendarId: string, syncToken?: string): Promise<{ events: GoogleEvent[], nextSyncToken?: string, fullSyncRequired?: boolean }> => {
    let params: Record<string, string> = { singleEvents: 'true', maxResults: '2500' };

    // Limit sync range to avoid infinite loops (e.g. infinite recurring birthdays)
    // Sync window: 1 month history to 2 years future
    const now = new Date();
    const futureLimit = new Date();
    futureLimit.setFullYear(now.getFullYear() + 2);

    if (syncToken) {
        params.syncToken = syncToken;
        // Note: Google API does not allow timeMin/timeMax with syncToken
    } else {
        // Initial Sync: Get from 1 month ago to 2 years in future
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        params.timeMin = start.toISOString();
        params.timeMax = futureLimit.toISOString();
    }

    let allEvents: any[] = [];
    let nextSyncToken: string | undefined;
    let pageToken: string | undefined;

    try {
        do {
            const qs = new URLSearchParams({ ...params, ...(pageToken ? { pageToken } : {}) });
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${qs}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (response.status === 410) {
                return { events: [], fullSyncRequired: true };
            }

            if (!response.ok) throw new Error('Sync Request Failed');

            const data = await response.json();
            if (data.items) {
                // Filter events that are too far in the future
                // AND FILTER OUT RECURRING EVENTS as requested
                const limitTime = futureLimit.getTime();
                const filtered = data.items.filter((e: any) => {
                    // Filter 1: No recurring events
                    if (e.recurringEventId) return false;

                    // Filter 2: Time limit
                    if (e.start && (e.start.dateTime || e.start.date)) {
                        const t = new Date(e.start.dateTime || e.start.date).getTime();
                        return t < limitTime;
                    }
                    return true; // Keep cancellations or events without time
                });
                allEvents.push(...filtered);
            }

            pageToken = data.nextPageToken;
            nextSyncToken = data.nextSyncToken;
        } while (pageToken);

        return { events: allEvents, nextSyncToken };
    } catch (e) {
        console.error(e);
        throw e;
    }
};
