/**
 * User Preferences Service
 * 
 * Handles syncing user preferences to Supabase for cross-browser/device persistence.
 * Falls back to localStorage if database sync fails.
 */
import { supabase } from '../supabaseClient';

export interface UserPreferences {
    viewTagFilters?: Record<string, { include: string[], exclude: string[] }>;
    heartViewState?: {
        isInHeartView: boolean;       // Whether user was in Our Time view
        viewMode: 'schedule' | 'moments';  // Schedule or Memories
        momentsLayoutMode: 'vertical' | 'horizontal';  // Layout for Memories
        selectedDate?: string;        // ISO date string
        selectedTagIds?: string[];    // Selected tag IDs for filtering
    };
    lastView?: string;  // Last active view
    sidebarCollapsed?: boolean;
    sidebarWidth?: number;
    expandedTags?: string[];
    themeSettings?: any;
}

const PREFERENCE_KEYS = {
    VIEW_TAG_FILTERS: 'viewTagFilters',
    HEART_VIEW_STATE: 'heartViewState',
    LAST_VIEW: 'lastView',
} as const;

// Debounce timers for each key
const saveTimers: Record<string, NodeJS.Timeout> = {};
const DEBOUNCE_MS = 1000;

/**
 * Load a specific preference from database
 */
export async function loadPreference<T = any>(
    userId: string,
    key: string
): Promise<T | null> {
    if (!supabase) {
        console.warn('[UserPrefs] Supabase not available, using localStorage');
        const local = localStorage.getItem(`pref_${key}_${userId}`);
        return local ? JSON.parse(local) : null;
    }

    try {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('preference_value')
            .eq('user_id', userId)
            .eq('preference_key', key)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found - not an error
                return null;
            }
            console.warn('[UserPrefs] Load error:', error);
            // Fallback to localStorage
            const local = localStorage.getItem(`pref_${key}_${userId}`);
            return local ? JSON.parse(local) : null;
        }

        return data?.preference_value as T;
    } catch (e) {
        console.error('[UserPrefs] Load exception:', e);
        const local = localStorage.getItem(`pref_${key}_${userId}`);
        return local ? JSON.parse(local) : null;
    }
}

/**
 * Save a specific preference to database (debounced)
 */
export async function savePreference(
    userId: string,
    key: string,
    value: any
): Promise<void> {
    // Always save to localStorage as immediate fallback
    localStorage.setItem(`pref_${key}_${userId}`, JSON.stringify(value));

    // Debounce database writes
    if (saveTimers[key]) {
        clearTimeout(saveTimers[key]);
    }

    saveTimers[key] = setTimeout(async () => {
        if (!supabase) return;

        try {
            const { error } = await supabase
                .from('user_preferences')
                .upsert({
                    user_id: userId,
                    preference_key: key,
                    preference_value: value,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,preference_key'
                });

            if (error) {
                console.warn('[UserPrefs] Save error:', error);
            }
        } catch (e) {
            console.error('[UserPrefs] Save exception:', e);
        }
    }, DEBOUNCE_MS);
}

/**
 * Load all preferences for a user
 */
export async function loadAllPreferences(userId: string): Promise<UserPreferences> {
    if (!supabase) {
        console.warn('[UserPrefs] Supabase not available');
        return loadFromLocalStorage(userId);
    }

    try {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('preference_key, preference_value')
            .eq('user_id', userId);

        if (error) {
            console.warn('[UserPrefs] Load all error:', error);
            return loadFromLocalStorage(userId);
        }

        const prefs: UserPreferences = {};
        data?.forEach(row => {
            (prefs as any)[row.preference_key] = row.preference_value;
        });

        // Merge with localStorage for any missing keys
        const localPrefs = loadFromLocalStorage(userId);
        return { ...localPrefs, ...prefs };
    } catch (e) {
        console.error('[UserPrefs] Load all exception:', e);
        return loadFromLocalStorage(userId);
    }
}

function loadFromLocalStorage(userId: string): UserPreferences {
    const prefs: UserPreferences = {};

    try {
        const viewTagFilters = localStorage.getItem('viewTagFilters');
        if (viewTagFilters) {
            prefs.viewTagFilters = JSON.parse(viewTagFilters);
        }

        // Heart view state from individual localStorage keys
        const heartViewMode = localStorage.getItem('heart_view_mode');
        const heartSelectedDate = localStorage.getItem('heart_selected_date');
        const heartScheduleTags = localStorage.getItem('heart_schedule_tags');
        const momentsLayoutMode = localStorage.getItem('moments_layout_mode');
        const lastView = localStorage.getItem(`last_view_${userId}`);

        prefs.heartViewState = {
            isInHeartView: lastView === 'heart',
            viewMode: (heartViewMode as 'schedule' | 'moments') || 'schedule',
            momentsLayoutMode: (momentsLayoutMode as 'vertical' | 'horizontal') || 'vertical',
            selectedDate: heartSelectedDate || undefined,
            selectedTagIds: heartScheduleTags ? JSON.parse(heartScheduleTags) : undefined
        };

        prefs.lastView = lastView || 'inbox';
    } catch (e) {
        console.error('[UserPrefs] localStorage parse error:', e);
    }

    return prefs;
}

// Export preference keys for type safety
export { PREFERENCE_KEYS };
